import { query } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { badRequest } from "../lib/errors.js";
import { maskPhone } from "../lib/phone.js";
import { requireDateString, requireEnum, requireReason } from "../lib/validation.js";
import { moneyAndHarvestTotals } from "./reportService.js";

// Ministry-level analytics for admins.
//
// Scope rules (kept simple and consistent so numbers always reconcile):
//   * The county filter is the FARMER's registered county. Every number on the
//     page (farms, activities, harvests, sales, members) belongs to farmers in
//     that county, so the county rows add up to the national total.
//   * The period (from/to) applies to dated records: new registrations,
//     activities, harvests, sales, payments and expenses. Stock numbers
//     (farmers, farms, land, members) are "as of today".
//   * Money is never converted between LRD and USD.
//   * Land is summed in hectares. "Lots" have no fixed size in Liberia, so
//     they are counted separately and never converted.

const HECTARES_SQL = `CASE fm.size_unit
  WHEN 'hectares' THEN fm.size
  WHEN 'acres' THEN fm.size * 0.40468564
  WHEN 'square_meters' THEN fm.size / 10000
  ELSE 0 END`;

const MAX_MONTHS = 36;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function parseAnalyticsScope(params = {}) {
  const today = new Date();
  const defaultTo = isoDate(today);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  const from = params.from ? requireDateString(params.from, "from", "start date") : isoDate(start);
  const to = params.to ? requireDateString(params.to, "to", "end date") : defaultTo;
  if (from > to) throw badRequest("The start date must be before the end date.", { field: "from" });

  const months =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) +
    1;
  if (months > MAX_MONTHS) {
    throw badRequest(`Choose a period of ${MAX_MONTHS} months or less.`, { field: "from" });
  }

  const county = params.county ? requireEnum(params.county, COUNTIES, "county", "county") : null;
  return { from, to, county };
}

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(Number(value || 0) * factor) / factor;
};

export async function getAnalytics(params = {}) {
  const { from, to, county } = parseAnalyticsScope(params);
  // $1 = county (or null), $2 = from, $3 = to
  const scope = [county, from, to];
  const farmerScope = `($1::text IS NULL OR f.county = $1)`;

  const kpiResult = await query(
    `SELECT
      (SELECT count(*)::int FROM farmers f WHERE ${farmerScope}) AS farmers,
      (SELECT count(*)::int FROM farmers f WHERE ${farmerScope} AND f.status = 'active') AS active_farmers,
      (SELECT count(*)::int FROM farmers f WHERE ${farmerScope}
        AND f.created_at::date BETWEEN $2 AND $3) AS new_farmers,
      (SELECT count(*)::int FROM farms fm JOIN farmers f ON f.id = fm.farmer_id WHERE ${farmerScope}) AS farms,
      (SELECT COALESCE(sum(${HECTARES_SQL}), 0) FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
        WHERE ${farmerScope}) AS area_hectares,
      (SELECT COALESCE(sum(fm.size), 0) FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
        WHERE ${farmerScope} AND fm.size_unit = 'lots') AS lots,
      (SELECT count(*)::int FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
        WHERE ${farmerScope} AND (fm.size IS NULL OR fm.size_unit IS NULL)) AS farms_without_size,
      (SELECT count(*)::int FROM cooperatives c WHERE c.status = 'active'
        AND ($1::text IS NULL OR c.county = $1)) AS cooperatives,
      (SELECT count(DISTINCT cm.farmer_id)::int FROM cooperative_members cm
        JOIN cooperatives c ON c.id = cm.cooperative_id AND c.status = 'active'
        JOIN farmers f ON f.id = cm.farmer_id
        WHERE cm.status = 'active' AND ${farmerScope}) AS coop_members,
      (SELECT count(*)::int FROM farm_activities a JOIN farmers f ON f.id = a.farmer_id
        WHERE a.deleted_at IS NULL AND ${farmerScope} AND a.activity_date BETWEEN $2 AND $3) AS activities,
      (SELECT count(*)::int FROM harvests h JOIN farmers f ON f.id = h.farmer_id
        WHERE h.deleted_at IS NULL AND ${farmerScope} AND h.harvest_date BETWEEN $2 AND $3) AS harvests,
      (SELECT count(*)::int FROM sales s JOIN farmers f ON f.id = s.farmer_id
        WHERE s.deleted_at IS NULL AND ${farmerScope} AND s.sale_date BETWEEN $2 AND $3) AS sales`,
    scope
  );
  const k = kpiResult.rows[0];

  // Engagement: a farmer is "recording" if they saved any activity, harvest,
  // sale or expense recently (by when it reached the server).
  const engagementResult = await query(
    `WITH touched AS (
       SELECT farmer_id, max(created_at) AS last_at FROM (
         SELECT farmer_id, created_at FROM farm_activities WHERE deleted_at IS NULL
         UNION ALL SELECT farmer_id, created_at FROM harvests WHERE deleted_at IS NULL
         UNION ALL SELECT farmer_id, created_at FROM sales WHERE deleted_at IS NULL
         UNION ALL SELECT farmer_id, created_at FROM expenses WHERE deleted_at IS NULL
       ) x GROUP BY farmer_id
     )
     SELECT
       count(*) FILTER (WHERE t.last_at >= now() - interval '7 days')::int AS last7,
       count(*) FILTER (WHERE t.last_at >= now() - interval '30 days'
                          AND t.last_at < now() - interval '7 days')::int AS last30,
       count(*) FILTER (WHERE t.last_at >= now() - interval '90 days'
                          AND t.last_at < now() - interval '30 days')::int AS last90,
       count(*) FILTER (WHERE t.last_at IS NULL OR t.last_at < now() - interval '90 days')::int AS dormant
     FROM farmers f LEFT JOIN touched t ON t.farmer_id = f.id
     WHERE ${farmerScope} AND f.status = 'active'`,
    [county]
  );

  const monthlyResult = await query(
    `WITH months AS (
       SELECT generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), interval '1 month')::date AS m
     )
     SELECT to_char(m.m, 'YYYY-MM') AS month,
       (SELECT count(*)::int FROM farmers f WHERE ${farmerScope}
         AND date_trunc('month', f.created_at)::date = m.m
         AND f.created_at::date BETWEEN $2 AND $3) AS new_farmers,
       (SELECT count(*)::int FROM farm_activities a JOIN farmers f ON f.id = a.farmer_id
         WHERE a.deleted_at IS NULL AND ${farmerScope}
         AND date_trunc('month', a.activity_date)::date = m.m AND a.activity_date BETWEEN $2 AND $3) AS activities,
       (SELECT count(*)::int FROM harvests h JOIN farmers f ON f.id = h.farmer_id
         WHERE h.deleted_at IS NULL AND ${farmerScope}
         AND date_trunc('month', h.harvest_date)::date = m.m AND h.harvest_date BETWEEN $2 AND $3) AS harvests,
       (SELECT COALESCE(sum(s.total_amount) FILTER (WHERE s.currency = 'LRD'), 0)
         FROM sales s JOIN farmers f ON f.id = s.farmer_id
         WHERE s.deleted_at IS NULL AND ${farmerScope}
         AND date_trunc('month', s.sale_date)::date = m.m AND s.sale_date BETWEEN $2 AND $3) AS sold_lrd,
       (SELECT COALESCE(sum(s.total_amount) FILTER (WHERE s.currency = 'USD'), 0)
         FROM sales s JOIN farmers f ON f.id = s.farmer_id
         WHERE s.deleted_at IS NULL AND ${farmerScope}
         AND date_trunc('month', s.sale_date)::date = m.m AND s.sale_date BETWEEN $2 AND $3) AS sold_usd
     FROM months m ORDER BY m.m`,
    scope
  );

  const counties = await countyBreakdown({ from, to });

  const farmTypeResult = await query(
    `SELECT fm.farm_type AS type, count(*)::int AS count
     FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
     WHERE ${farmerScope} GROUP BY fm.farm_type ORDER BY count DESC`,
    [county]
  );
  const cropResult = await query(
    `SELECT upper(left(k.crop, 1)) || substr(k.crop, 2) AS crop, k.farms FROM (
       SELECT lower(regexp_replace(trim(fm.main_crop_or_livestock), '\\s+', ' ', 'g')) AS crop, count(*)::int AS farms
       FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
       WHERE ${farmerScope} AND nullif(trim(fm.main_crop_or_livestock), '') IS NOT NULL
       GROUP BY 1
     ) k ORDER BY k.farms DESC, k.crop`,
    [county]
  );
  const activityTypeResult = await query(
    `SELECT a.activity_type AS type, count(*)::int AS count
     FROM farm_activities a JOIN farmers f ON f.id = a.farmer_id
     WHERE a.deleted_at IS NULL AND ${farmerScope} AND a.activity_date BETWEEN $2 AND $3
     GROUP BY a.activity_type ORDER BY count DESC`,
    scope
  );

  const cooperatives = await cooperativeBreakdown({ from, to, county });

  const idsResult = await query(`SELECT f.id FROM farmers f WHERE ${farmerScope}`, [county]);
  const farmerIds = idsResult.rows.map((row) => row.id);
  const totals = await moneyAndHarvestTotals(farmerIds, { from, to });

  const e = engagementResult.rows[0];
  return {
    period: { from, to },
    county,
    kpis: {
      farmers: k.farmers,
      activeFarmers: k.active_farmers,
      newFarmers: k.new_farmers,
      farms: k.farms,
      areaHectares: round(k.area_hectares, 1),
      lots: round(k.lots, 1),
      farmsWithoutSize: k.farms_without_size,
      cooperatives: k.cooperatives,
      coopMembers: k.coop_members,
      coopCoveragePercent: k.farmers ? round((k.coop_members / k.farmers) * 100, 1) : 0,
      activities: k.activities,
      harvests: k.harvests,
      sales: k.sales,
      money: totals.money
    },
    engagement: {
      last7Days: e.last7,
      last30Days: e.last30,
      last90Days: e.last90,
      dormant: e.dormant
    },
    monthly: monthlyResult.rows.map((row) => ({
      month: row.month,
      newFarmers: row.new_farmers,
      activities: row.activities,
      harvests: row.harvests,
      soldLRD: Number(row.sold_lrd),
      soldUSD: Number(row.sold_usd)
    })),
    counties,
    farmTypes: farmTypeResult.rows,
    crops: cropResult.rows,
    activityTypes: activityTypeResult.rows,
    harvestByCrop: totals.harvest,
    grades: { A: 0, B: 0, C: 0, rejected: 0, ...totals.grades },
    spentByCategory: totals.spentByCategory,
    cooperatives
  };
}

// One row per county (all 15, even empty ones, so gaps are visible).
export async function countyBreakdown({ from, to }) {
  const { rows } = await query(
    `SELECT c.county,
       (SELECT count(*)::int FROM farmers f WHERE f.county = c.county) AS farmers,
       (SELECT count(*)::int FROM farmers f WHERE f.county = c.county AND f.status = 'active') AS active_farmers,
       (SELECT count(*)::int FROM farmers f WHERE f.county = c.county
         AND f.created_at::date BETWEEN $2 AND $3) AS new_farmers,
       (SELECT count(*)::int FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
         WHERE f.county = c.county) AS farms,
       (SELECT COALESCE(sum(${HECTARES_SQL}), 0) FROM farms fm JOIN farmers f ON f.id = fm.farmer_id
         WHERE f.county = c.county) AS area_hectares,
       (SELECT count(DISTINCT cm.farmer_id)::int FROM cooperative_members cm
         JOIN cooperatives co ON co.id = cm.cooperative_id AND co.status = 'active'
         JOIN farmers f ON f.id = cm.farmer_id
         WHERE cm.status = 'active' AND f.county = c.county) AS coop_members,
       (SELECT count(*)::int FROM farm_activities a JOIN farmers f ON f.id = a.farmer_id
         WHERE a.deleted_at IS NULL AND f.county = c.county AND a.activity_date BETWEEN $2 AND $3) AS activities,
       (SELECT count(*)::int FROM harvests h JOIN farmers f ON f.id = h.farmer_id
         WHERE h.deleted_at IS NULL AND f.county = c.county AND h.harvest_date BETWEEN $2 AND $3) AS harvests,
       (SELECT COALESCE(sum(s.total_amount) FILTER (WHERE s.currency = 'LRD'), 0)
         FROM sales s JOIN farmers f ON f.id = s.farmer_id
         WHERE s.deleted_at IS NULL AND f.county = c.county AND s.sale_date BETWEEN $2 AND $3) AS sold_lrd,
       (SELECT COALESCE(sum(s.total_amount) FILTER (WHERE s.currency = 'USD'), 0)
         FROM sales s JOIN farmers f ON f.id = s.farmer_id
         WHERE s.deleted_at IS NULL AND f.county = c.county AND s.sale_date BETWEEN $2 AND $3) AS sold_usd
     FROM unnest($1::text[]) AS c(county)
     ORDER BY c.county`,
    [COUNTIES, from, to]
  );
  return rows.map((row) => ({
    county: row.county,
    farmers: row.farmers,
    activeFarmers: row.active_farmers,
    newFarmers: row.new_farmers,
    farms: row.farms,
    areaHectares: round(row.area_hectares, 1),
    coopMembers: row.coop_members,
    activities: row.activities,
    harvests: row.harvests,
    soldLRD: Number(row.sold_lrd),
    soldUSD: Number(row.sold_usd)
  }));
}

export async function cooperativeBreakdown({ from, to, county = null }) {
  const { rows } = await query(
    `WITH members AS (
       SELECT cm.cooperative_id, cm.farmer_id, cm.role FROM cooperative_members cm WHERE cm.status = 'active'
     )
     SELECT c.id, c.name, c.county, c.district, c.status, c.created_at,
       (SELECT count(*)::int FROM members m WHERE m.cooperative_id = c.id) AS members,
       (SELECT count(*)::int FROM members m WHERE m.cooperative_id = c.id AND m.role = 'leader') AS leaders,
       (SELECT count(*)::int FROM harvests h JOIN members m ON m.farmer_id = h.farmer_id AND m.cooperative_id = c.id
         WHERE h.deleted_at IS NULL AND h.harvest_date BETWEEN $2 AND $3) AS harvests,
       (SELECT COALESCE(sum(s.total_amount) FILTER (WHERE s.currency = 'LRD'), 0)
         FROM sales s JOIN members m ON m.farmer_id = s.farmer_id AND m.cooperative_id = c.id
         WHERE s.deleted_at IS NULL AND s.sale_date BETWEEN $2 AND $3) AS sold_lrd,
       (SELECT COALESCE(sum(s.total_amount) FILTER (WHERE s.currency = 'USD'), 0)
         FROM sales s JOIN members m ON m.farmer_id = s.farmer_id AND m.cooperative_id = c.id
         WHERE s.deleted_at IS NULL AND s.sale_date BETWEEN $2 AND $3) AS sold_usd
     FROM cooperatives c
     WHERE ($1::text IS NULL OR c.county = $1)
     ORDER BY members DESC, c.name`,
    [county, from, to]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    county: row.county,
    district: row.district,
    status: row.status,
    createdAt: row.created_at,
    members: row.members,
    leaders: row.leaders,
    harvests: row.harvests,
    soldLRD: Number(row.sold_lrd),
    soldUSD: Number(row.sold_usd)
  }));
}

// ---------- CSV export ----------

function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // Stop spreadsheet formula injection (=, +, -, @ at the start of a cell).
  // Plain numbers and phone numbers (+231...) are left alone.
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d[\d.]*$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.map((column) => csvCell(column.label)).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(column.value(row))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const EXPORT_DATASETS = ["farmers", "counties", "cooperatives", "monthly"];

// A single download is capped so one export cannot pull the whole register.
function limitRows(rows) {
  const configured = Number(process.env.MAX_EXPORT_ROWS);
  const maxRows = Number.isFinite(configured) && configured > 0 ? configured : 5000;
  const truncated = rows.length > maxRows;
  return {
    rows: truncated ? rows.slice(0, maxRows) : rows,
    rowCount: truncated ? maxRows : rows.length,
    truncated
  };
}

export async function exportDataset(dataset, params = {}) {
  if (!EXPORT_DATASETS.includes(dataset)) throw badRequest("Unknown export.", { field: "dataset" });
  const purpose = requireReason(params.purpose, "purpose", "Purpose");
  const { from, to, county } = parseAnalyticsScope(params);
  const suffix = `${county ? county.replace(/\s+/g, "-").toLowerCase() + "-" : ""}${from}_to_${to}`;
  const scope = { from, to, county, purpose };

  if (dataset === "counties") {
    const limited = limitRows(await countyBreakdown({ from, to }));
    const rows = limited.rows;
    return {
      filename: `farmbok-counties-${from}_to_${to}.csv`,
      rowCount: limited.rowCount,
      truncated: limited.truncated,
      scope,
      csv: toCsv(
        [
          { label: "County", value: (r) => r.county },
          { label: "Farmers", value: (r) => r.farmers },
          { label: "Active farmers", value: (r) => r.activeFarmers },
          { label: `New farmers (${from} to ${to})`, value: (r) => r.newFarmers },
          { label: "Farms", value: (r) => r.farms },
          { label: "Land (hectares)", value: (r) => r.areaHectares },
          { label: "Cooperative members", value: (r) => r.coopMembers },
          { label: "Activities in period", value: (r) => r.activities },
          { label: "Harvest batches in period", value: (r) => r.harvests },
          { label: "Sales in period (LRD)", value: (r) => r.soldLRD },
          { label: "Sales in period (USD)", value: (r) => r.soldUSD }
        ],
        rows
      )
    };
  }

  if (dataset === "cooperatives") {
    const limited = limitRows(await cooperativeBreakdown({ from, to, county }));
    const rows = limited.rows;
    return {
      filename: `farmbok-cooperatives-${suffix}.csv`,
      rowCount: limited.rowCount,
      truncated: limited.truncated,
      scope,
      csv: toCsv(
        [
          { label: "Cooperative", value: (r) => r.name },
          { label: "County", value: (r) => r.county },
          { label: "District", value: (r) => r.district },
          { label: "Status", value: (r) => r.status },
          { label: "Members", value: (r) => r.members },
          { label: "Leaders", value: (r) => r.leaders },
          { label: "Harvest batches in period", value: (r) => r.harvests },
          { label: "Sales in period (LRD)", value: (r) => r.soldLRD },
          { label: "Sales in period (USD)", value: (r) => r.soldUSD },
          { label: "Created", value: (r) => r.createdAt }
        ],
        rows
      )
    };
  }

  if (dataset === "monthly") {
    const analytics = await getAnalytics({ from, to, county });
    const limited = limitRows(analytics.monthly);
    return {
      filename: `farmbok-monthly-${suffix}.csv`,
      rowCount: limited.rowCount,
      truncated: limited.truncated,
      scope,
      csv: toCsv(
        [
          { label: "Month", value: (r) => r.month },
          { label: "New farmers", value: (r) => r.newFarmers },
          { label: "Activities", value: (r) => r.activities },
          { label: "Harvest batches", value: (r) => r.harvests },
          { label: "Sales (LRD)", value: (r) => r.soldLRD },
          { label: "Sales (USD)", value: (r) => r.soldUSD }
        ],
        limited.rows
      )
    };
  }

  // farmers: one row per farmer, no PIN or recovery data. Phone numbers are
  // masked so the file cannot be turned into a contact list.
  const farmerResult = await query(
    `SELECT f.full_name, f.phone_number, f.county, f.district, f.community, f.status, f.created_at,
       (SELECT count(*)::int FROM farms fm WHERE fm.farmer_id = f.id) AS farms,
       (SELECT COALESCE(sum(${HECTARES_SQL}), 0) FROM farms fm WHERE fm.farmer_id = f.id) AS area_hectares,
       (SELECT count(*)::int FROM farm_activities a WHERE a.farmer_id = f.id AND a.deleted_at IS NULL
         AND a.activity_date BETWEEN $2 AND $3) AS activities,
       (SELECT count(*)::int FROM harvests h WHERE h.farmer_id = f.id AND h.deleted_at IS NULL
         AND h.harvest_date BETWEEN $2 AND $3) AS harvests,
       (SELECT string_agg(c.name, '; ' ORDER BY c.name) FROM cooperative_members cm
         JOIN cooperatives c ON c.id = cm.cooperative_id
         WHERE cm.farmer_id = f.id AND cm.status = 'active') AS cooperatives
     FROM farmers f
     WHERE ($1::text IS NULL OR f.county = $1)
     ORDER BY f.county, f.full_name`,
    [county, from, to]
  );
  const limited = limitRows(farmerResult.rows);
  return {
    filename: `farmbok-farmers-${suffix}.csv`,
    rowCount: limited.rowCount,
    truncated: limited.truncated,
    scope,
    csv: toCsv(
      [
        { label: "Full name", value: (r) => r.full_name },
        { label: "Phone", value: (r) => maskPhone(r.phone_number) },
        { label: "County", value: (r) => r.county },
        { label: "District", value: (r) => r.district },
        { label: "Community", value: (r) => r.community },
        { label: "Status", value: (r) => r.status },
        { label: "Registered", value: (r) => r.created_at },
        { label: "Farms", value: (r) => r.farms },
        { label: "Land (hectares)", value: (r) => round(r.area_hectares, 2) },
        { label: "Activities in period", value: (r) => r.activities },
        { label: "Harvest batches in period", value: (r) => r.harvests },
        { label: "Cooperatives", value: (r) => r.cooperatives }
      ],
      limited.rows
    )
  };
}
