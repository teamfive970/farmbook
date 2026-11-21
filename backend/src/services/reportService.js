import { query } from "../config/database.js";
import { requireDateString } from "../lib/validation.js";

// Totals for one farmer or a group of farmers. Liberian dollars and US
// dollars are kept apart (never converted), because the rate changes.
//   sold       = value of sales made in the period
//   received   = money actually paid in the period
//   owed       = what buyers still owe on sales in the period
//   spent      = expenses in the period
//   profit     = received − spent (money in hand), per currency
function range(params = {}) {
  const from = params.from ? requireDateString(params.from, "from", "start date") : null;
  const to = params.to ? requireDateString(params.to, "to", "end date") : null;
  return { from, to };
}

function byCurrency(rows, field) {
  const out = { LRD: 0, USD: 0 };
  for (const row of rows) out[row.currency] = Number(row[field] || 0);
  return out;
}

export async function moneyAndHarvestTotals(farmerIds, params = {}) {
  const { from, to } = range(params);
  const ids = [farmerIds].flat();

  const sold = await query(
    `SELECT currency, COALESCE(sum(total_amount), 0) AS total
     FROM sales
     WHERE farmer_id = ANY($1) AND deleted_at IS NULL
       AND ($2::date IS NULL OR sale_date >= $2) AND ($3::date IS NULL OR sale_date <= $3)
     GROUP BY currency`,
    [ids, from, to]
  );
  const received = await query(
    `SELECT s.currency, COALESCE(sum(p.amount), 0) AS total
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE p.farmer_id = ANY($1) AND p.deleted_at IS NULL AND s.deleted_at IS NULL
       AND ($2::date IS NULL OR p.paid_date >= $2) AND ($3::date IS NULL OR p.paid_date <= $3)
     GROUP BY s.currency`,
    [ids, from, to]
  );
  const owed = await query(
    `SELECT s.currency,
       COALESCE(sum(GREATEST(s.total_amount - COALESCE(paid.total, 0), 0)), 0) AS total
     FROM sales s
     LEFT JOIN LATERAL (
       SELECT sum(amount) AS total FROM payments
       WHERE sale_id = s.id AND deleted_at IS NULL
     ) paid ON true
     WHERE s.farmer_id = ANY($1) AND s.deleted_at IS NULL
       AND ($2::date IS NULL OR s.sale_date >= $2) AND ($3::date IS NULL OR s.sale_date <= $3)
     GROUP BY s.currency`,
    [ids, from, to]
  );
  const spent = await query(
    `SELECT currency, COALESCE(sum(amount), 0) AS total
     FROM expenses
     WHERE farmer_id = ANY($1) AND deleted_at IS NULL
       AND ($2::date IS NULL OR expense_date >= $2) AND ($3::date IS NULL OR expense_date <= $3)
     GROUP BY currency`,
    [ids, from, to]
  );
  const spentByCategory = await query(
    `SELECT category, currency, sum(amount) AS total
     FROM expenses
     WHERE farmer_id = ANY($1) AND deleted_at IS NULL
       AND ($2::date IS NULL OR expense_date >= $2) AND ($3::date IS NULL OR expense_date <= $3)
     GROUP BY category, currency ORDER BY category`,
    [ids, from, to]
  );
  const harvest = await query(
    `SELECT crop, unit, sum(quantity) AS quantity, count(*)::int AS batches
     FROM harvests
     WHERE farmer_id = ANY($1) AND deleted_at IS NULL
       AND ($2::date IS NULL OR harvest_date >= $2) AND ($3::date IS NULL OR harvest_date <= $3)
     GROUP BY crop, unit ORDER BY crop`,
    [ids, from, to]
  );
  const grades = await query(
    `SELECT grade, count(*)::int AS count
     FROM (
       SELECT DISTINCT ON (q.harvest_id) q.grade
       FROM quality_inspections q JOIN harvests h ON h.id = q.harvest_id
       WHERE q.farmer_id = ANY($1) AND q.deleted_at IS NULL AND h.deleted_at IS NULL
         AND ($2::date IS NULL OR h.harvest_date >= $2) AND ($3::date IS NULL OR h.harvest_date <= $3)
       ORDER BY q.harvest_id, q.inspection_date DESC, q.created_at DESC
     ) latest
     GROUP BY grade`,
    [ids, from, to]
  );

  const money = {
    sold: byCurrency(sold.rows, "total"),
    received: byCurrency(received.rows, "total"),
    owed: byCurrency(owed.rows, "total"),
    spent: byCurrency(spent.rows, "total")
  };
  money.profit = {
    LRD: Math.round((money.received.LRD - money.spent.LRD) * 100) / 100,
    USD: Math.round((money.received.USD - money.spent.USD) * 100) / 100
  };

  return {
    period: { from, to },
    money,
    spentByCategory: spentByCategory.rows.map((row) => ({
      category: row.category,
      currency: row.currency,
      total: Number(row.total)
    })),
    harvest: harvest.rows.map((row) => ({
      crop: row.crop,
      unit: row.unit,
      quantity: Number(row.quantity),
      batches: row.batches
    })),
    grades: Object.fromEntries(grades.rows.map((row) => [row.grade, row.count]))
  };
}

export function farmerSummary(farmerId, params) {
  return moneyAndHarvestTotals(farmerId, params);
}
