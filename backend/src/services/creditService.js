import crypto from "node:crypto";
import { query } from "../config/database.js";
import { badRequest, notFound } from "../lib/errors.js";
import { optionalString, requireUuid } from "../lib/validation.js";

// Farm record for a lender (micro-finance, a bank, a VSLA or a cooperative).
//
// The farmer makes a private link (code CR-XXXXXXXXXX). The lender opens it
// without signing in and sees a summary of the last 12 months worked out from
// the farmer's records: money in and out each month, harvests and sales, how
// regularly the farmer keeps records, quality checks and group membership.
// The farmer chooses whether to show their name and phone, the link stops
// working after the chosen number of days, and the farmer can stop it sooner.

const MAX_ACTIVE = 10;
const DAYS = [7, 30, 90];

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (const byte of crypto.randomBytes(10)) code += alphabet[byte % alphabet.length];
  return `CR-${code}`;
}

function serializeShare(row) {
  const now = Date.now();
  const status = row.revoked_at ? "stopped" : new Date(row.expires_at).getTime() <= now ? "expired" : "active";
  return {
    id: row.id,
    code: row.code,
    lenderName: row.lender_name,
    includeContact: row.include_contact,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    status
  };
}

export async function listShares(farmerId) {
  const { rows } = await query(
    "SELECT * FROM credit_shares WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 30",
    [farmerId]
  );
  return { shares: rows.map(serializeShare) };
}

export async function createShare(farmerId, body = {}) {
  const lenderName = optionalString(body.lenderName, "lenderName", { max: 80, label: "Lender name" });
  const includeContact = body.includeContact === undefined ? true : body.includeContact;
  if (typeof includeContact !== "boolean") throw badRequest("Choose yes or no.", { field: "includeContact" });
  const days = body.days === undefined ? 30 : Number(body.days);
  if (!DAYS.includes(days)) throw badRequest("Choose 7, 30 or 90 days.", { field: "days" });

  const active = await query(
    "SELECT count(*)::int AS n FROM credit_shares WHERE farmer_id = $1 AND revoked_at IS NULL AND expires_at > now()",
    [farmerId]
  );
  if (active.rows[0].n >= MAX_ACTIVE) {
    throw badRequest("You already have many open links. Stop one you no longer need first.", { field: "days" });
  }
  const { rows } = await query(
    `INSERT INTO credit_shares (farmer_id, code, lender_name, include_contact, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5)) RETURNING *`,
    [farmerId, randomCode(), lenderName || null, includeContact, days]
  );
  return { share: serializeShare(rows[0]) };
}

export async function revokeShare(farmerId, id) {
  requireUuid(id, "id", "link");
  const { rows } = await query(
    `UPDATE credit_shares SET revoked_at = COALESCE(revoked_at, now())
     WHERE id = $1 AND farmer_id = $2 RETURNING *`,
    [id, farmerId]
  );
  if (!rows[0]) throw notFound("This link was not found.");
  return { share: serializeShare(rows[0]) };
}

// ---------------------------------------------------------------------------
// The record the lender sees
// ---------------------------------------------------------------------------

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

function lastTwelveMonths(today = new Date()) {
  const months = [];
  for (let back = 11; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

export async function buildCreditRecord(farmerId, today = new Date()) {
  const months = lastTwelveMonths(today);
  const from = `${months[0]}-01`;
  const [farmer, money, costs, harvests, sales, work, farms, groups, grades] = await Promise.all([
    query("SELECT full_name, phone_number, county, district, community, created_at FROM farmers WHERE id = $1", [farmerId]),
    query(
      `SELECT to_char(p.paid_date, 'YYYY-MM') AS month, s.currency, sum(p.amount) AS total
       FROM payments p JOIN sales s ON s.id = p.sale_id
       WHERE p.farmer_id = $1 AND p.deleted_at IS NULL AND s.deleted_at IS NULL AND p.paid_date >= $2
       GROUP BY 1, 2`,
      [farmerId, from]
    ),
    query(
      `SELECT to_char(expense_date, 'YYYY-MM') AS month, currency, sum(amount) AS total
       FROM expenses WHERE farmer_id = $1 AND deleted_at IS NULL AND expense_date >= $2
       GROUP BY 1, 2`,
      [farmerId, from]
    ),
    query(
      `SELECT crop, unit, sum(quantity) AS quantity, count(*)::int AS batches
       FROM harvests WHERE farmer_id = $1 AND deleted_at IS NULL AND harvest_date >= $2
       GROUP BY crop, unit ORDER BY sum(quantity) DESC`,
      [farmerId, from]
    ),
    query(
      `SELECT s.currency, count(*)::int AS sales, sum(s.total_amount) AS value,
              count(DISTINCT COALESCE(s.buyer_id::text, s.buyer_client_id))::int AS buyers,
              count(*) FILTER (WHERE COALESCE(paid.total, 0) >= s.total_amount)::int AS fully_paid
       FROM sales s
       LEFT JOIN LATERAL (SELECT sum(amount) AS total FROM payments WHERE sale_id = s.id AND deleted_at IS NULL) paid ON true
       WHERE s.farmer_id = $1 AND s.deleted_at IS NULL AND s.sale_date >= $2
       GROUP BY s.currency`,
      [farmerId, from]
    ),
    query(
      `SELECT count(*)::int AS activities, count(DISTINCT to_char(activity_date, 'YYYY-MM'))::int AS months
       FROM farm_activities WHERE farmer_id = $1 AND deleted_at IS NULL AND activity_date >= $2`,
      [farmerId, from]
    ),
    query(
      "SELECT farm_type, county, size, size_unit, crops, main_crop_or_livestock FROM farms WHERE farmer_id = $1 ORDER BY created_at",
      [farmerId]
    ),
    query(
      `SELECT c.name, m.role, m.joined_at FROM cooperative_members m JOIN cooperatives c ON c.id = m.cooperative_id
       WHERE m.farmer_id = $1 AND m.status = 'active' AND c.status = 'active' ORDER BY c.name`,
      [farmerId]
    ),
    query(
      `SELECT grade, count(*)::int AS count FROM (
         SELECT DISTINCT ON (q.harvest_id) q.grade FROM quality_inspections q JOIN harvests h ON h.id = q.harvest_id
         WHERE q.farmer_id = $1 AND q.deleted_at IS NULL AND h.deleted_at IS NULL AND h.harvest_date >= $2
         ORDER BY q.harvest_id, q.inspection_date DESC, q.created_at DESC
       ) latest GROUP BY grade`,
      [farmerId, from]
    )
  ]);

  const monthly = months.map((month) => {
    const row = { month, in: { LRD: 0, USD: 0 }, out: { LRD: 0, USD: 0 } };
    for (const item of money.rows) if (item.month === month) row.in[item.currency] = round(item.total);
    for (const item of costs.rows) if (item.month === month) row.out[item.currency] = round(item.total);
    return row;
  });
  const totals = { in: { LRD: 0, USD: 0 }, out: { LRD: 0, USD: 0 }, profit: { LRD: 0, USD: 0 } };
  for (const row of monthly) {
    for (const currency of ["LRD", "USD"]) {
      totals.in[currency] = round(totals.in[currency] + row.in[currency]);
      totals.out[currency] = round(totals.out[currency] + row.out[currency]);
    }
  }
  for (const currency of ["LRD", "USD"]) totals.profit[currency] = round(totals.in[currency] - totals.out[currency]);
  const monthsWithMoney = monthly.filter((row) => row.in.LRD || row.in.USD).length;
  const recordMonths = new Set([
    ...money.rows.map((row) => row.month),
    ...costs.rows.map((row) => row.month)
  ]);

  const person = farmer.rows[0];
  const crops = [...new Set(farms.rows.flatMap((farm) => (farm.crops?.length ? farm.crops : String(farm.main_crop_or_livestock || "").split(/\s*,\s*/)).filter(Boolean)))];
  const sizes = {};
  for (const farm of farms.rows) if (farm.size && farm.size_unit) sizes[farm.size_unit] = round((sizes[farm.size_unit] || 0) + Number(farm.size));

  return {
    period: { from, to: today.toISOString().slice(0, 10), months: months.length },
    farmer: {
      name: person.full_name,
      phone: person.phone_number,
      place: [...new Set([person.community, person.district, person.county].filter(Boolean))].join(", "),
      county: person.county,
      usingFarmBokSince: person.created_at
    },
    farms: { count: farms.rows.length, crops, size: sizes },
    groups: groups.rows.map((row) => ({ name: row.name, role: row.role, since: row.joined_at })),
    monthly,
    totals,
    sales: sales.rows.map((row) => ({
      currency: row.currency,
      count: row.sales,
      value: round(row.value),
      buyers: row.buyers,
      fullyPaid: row.fully_paid
    })),
    harvests: harvests.rows.map((row) => ({ crop: row.crop, unit: row.unit, quantity: round(row.quantity), batches: row.batches })),
    quality: Object.fromEntries(grades.rows.map((row) => [row.grade, row.count])),
    recordKeeping: {
      activities: work.rows[0].activities,
      monthsWithFarmWork: work.rows[0].months,
      monthsWithMoneyRecords: recordMonths.size,
      monthsWithIncome: monthsWithMoney
    }
  };
}

export async function getCreditRecord(code) {
  if (!/^CR-[A-Z0-9]{10}$/.test(String(code || ""))) throw notFound("This link is not valid.");
  const { rows } = await query(
    `UPDATE credit_shares SET view_count = view_count + 1, last_viewed_at = now()
     WHERE code = $1 AND revoked_at IS NULL AND expires_at > now()
     RETURNING *`,
    [code]
  );
  const share = rows[0];
  if (!share) throw notFound("This link has stopped working. Ask the farmer for a new one.");
  const status = await query("SELECT status FROM farmers WHERE id = $1", [share.farmer_id]);
  if (status.rows[0]?.status !== "active") throw notFound("This link has stopped working. Ask the farmer for a new one.");
  const record = await buildCreditRecord(share.farmer_id);
  if (!share.include_contact) {
    record.farmer.name = record.farmer.name.split(/\s+/)[0];
    record.farmer.phone = null;
    record.farmer.place = record.farmer.county;
  }
  return {
    record,
    share: { code: share.code, lenderName: share.lender_name, expiresAt: share.expires_at, includeContact: share.include_contact },
    generatedAt: new Date().toISOString(),
    note: "Made by FarmBok from the farmer's own records. Amounts recorded by the farmer; quality grades by agriculture staff. Liberian and US dollars are never added together."
  };
}
