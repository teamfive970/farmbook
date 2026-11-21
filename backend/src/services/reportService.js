import { query } from "../config/database.js";
import { requireDateString } from "../lib/validation.js";

// Totals for one farmer or a group of farmers. Liberian dollars and US
// dollars are kept apart (never converted), because the rate changes.
//   sold (total sales) = value of sales made in the period
//   received (income)  = money actually paid in the period
//   owed               = what buyers still owe on sales in the period
//                        (kept for reports; farmer screens no longer show it)
//   spent (expenses)   = farm costs in the period
//   profit             = income − expenses (money in hand), per currency
// The phone works out the same numbers in frontend/src/lib/ledger.js; a test
// checks the two agree.
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
  money.income = { ...money.received };
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

export async function farmerSummary(farmerId, params = {}) {
  const totals = await moneyAndHarvestTotals(farmerId, params);
  const { from, to } = totals.period;
  const counts = await query(
    `SELECT
       (SELECT count(*)::int FROM sales WHERE farmer_id = $1 AND deleted_at IS NULL
          AND ($2::date IS NULL OR sale_date >= $2) AND ($3::date IS NULL OR sale_date <= $3)) AS sales,
       (SELECT count(*)::int FROM expenses WHERE farmer_id = $1 AND deleted_at IS NULL
          AND ($2::date IS NULL OR expense_date >= $2) AND ($3::date IS NULL OR expense_date <= $3)) AS expenses,
       (SELECT count(*)::int FROM harvests WHERE farmer_id = $1 AND deleted_at IS NULL
          AND ($2::date IS NULL OR harvest_date >= $2) AND ($3::date IS NULL OR harvest_date <= $3)) AS harvests`,
    [farmerId, from, to]
  );

  // Per harvest batch: what its sales were worth, what was received, and the
  // costs recorded for that batch. Profit = income − costs, like everywhere.
  const batches = await query(
    `SELECT h.client_id, h.crop, h.unit, h.quantity, f.client_id AS farm_client_id, s.currency,
       COALESCE(sum(s.total_amount) FILTER (WHERE ($2::date IS NULL OR s.sale_date >= $2)
                                              AND ($3::date IS NULL OR s.sale_date <= $3)), 0) AS sold
     FROM harvests h
     JOIN farms f ON f.id = h.farm_id
     JOIN sales s ON s.harvest_id = h.id AND s.deleted_at IS NULL
     WHERE h.farmer_id = $1 AND h.deleted_at IS NULL
     GROUP BY h.client_id, h.crop, h.unit, h.quantity, f.client_id, s.currency`,
    [farmerId, from, to]
  );
  const batchIncome = await query(
    `SELECT h.client_id, s.currency, COALESCE(sum(p.amount), 0) AS received
     FROM payments p JOIN sales s ON s.id = p.sale_id JOIN harvests h ON h.id = s.harvest_id
     WHERE p.farmer_id = $1 AND p.deleted_at IS NULL AND s.deleted_at IS NULL AND h.deleted_at IS NULL
       AND ($2::date IS NULL OR p.paid_date >= $2) AND ($3::date IS NULL OR p.paid_date <= $3)
     GROUP BY h.client_id, s.currency`,
    [farmerId, from, to]
  );
  const batchSpent = await query(
    `SELECT h.client_id, h.crop, f.client_id AS farm_client_id, e.currency, COALESCE(sum(e.amount), 0) AS spent
     FROM expenses e JOIN harvests h ON h.id = e.harvest_id JOIN farms f ON f.id = h.farm_id
     WHERE e.farmer_id = $1 AND e.deleted_at IS NULL AND h.deleted_at IS NULL
       AND ($2::date IS NULL OR e.expense_date >= $2) AND ($3::date IS NULL OR e.expense_date <= $3)
     GROUP BY h.client_id, h.crop, f.client_id, e.currency`,
    [farmerId, from, to]
  );
  const batchRows = new Map();
  const batchRow = (clientId, crop, farmClientId, currency) => {
    const key = `${clientId}:${currency}`;
    if (!batchRows.has(key)) {
      batchRows.set(key, { harvestClientId: clientId, farmClientId, crop, currency, sold: 0, income: 0, spent: 0 });
    }
    return batchRows.get(key);
  };
  for (const row of batches.rows) batchRow(row.client_id, row.crop, row.farm_client_id, row.currency).sold = Number(row.sold);
  for (const row of batchSpent.rows) batchRow(row.client_id, row.crop, row.farm_client_id, row.currency).spent = Number(row.spent);
  for (const row of batchIncome.rows) {
    const key = `${row.client_id}:${row.currency}`;
    if (batchRows.has(key)) batchRows.get(key).income = Number(row.received);
  }
  const byBatch = [...batchRows.values()]
    .map((row) => ({ ...row, profit: Math.round((row.income - row.spent) * 100) / 100 }))
    .filter((row) => row.sold || row.income || row.spent);

  // Per farm: income from its harvests' sales minus the costs recorded for it.
  const farmIncome = await query(
    `SELECT f.client_id, s.currency, COALESCE(sum(p.amount), 0) AS income
     FROM payments p JOIN sales s ON s.id = p.sale_id JOIN harvests h ON h.id = s.harvest_id
     JOIN farms f ON f.id = h.farm_id
     WHERE p.farmer_id = $1 AND p.deleted_at IS NULL AND s.deleted_at IS NULL AND h.deleted_at IS NULL
       AND ($2::date IS NULL OR p.paid_date >= $2) AND ($3::date IS NULL OR p.paid_date <= $3)
     GROUP BY f.client_id, s.currency`,
    [farmerId, from, to]
  );
  const farmSold = await query(
    `SELECT f.client_id, s.currency, COALESCE(sum(s.total_amount), 0) AS sold
     FROM sales s JOIN harvests h ON h.id = s.harvest_id JOIN farms f ON f.id = h.farm_id
     WHERE s.farmer_id = $1 AND s.deleted_at IS NULL AND h.deleted_at IS NULL
       AND ($2::date IS NULL OR s.sale_date >= $2) AND ($3::date IS NULL OR s.sale_date <= $3)
     GROUP BY f.client_id, s.currency`,
    [farmerId, from, to]
  );
  const farmSpent = await query(
    `SELECT f.client_id, e.currency, COALESCE(sum(e.amount), 0) AS spent
     FROM expenses e JOIN farms f ON f.id = e.farm_id
     WHERE e.farmer_id = $1 AND e.deleted_at IS NULL
       AND ($2::date IS NULL OR e.expense_date >= $2) AND ($3::date IS NULL OR e.expense_date <= $3)
     GROUP BY f.client_id, e.currency`,
    [farmerId, from, to]
  );
  const farms = new Map();
  const farmRow = (clientId, currency) => {
    const key = `${clientId}:${currency}`;
    if (!farms.has(key)) farms.set(key, { farmClientId: clientId, currency, sold: 0, income: 0, spent: 0 });
    return farms.get(key);
  };
  for (const row of farmSold.rows) farmRow(row.client_id, row.currency).sold = Number(row.sold);
  for (const row of farmIncome.rows) farmRow(row.client_id, row.currency).income = Number(row.income);
  for (const row of farmSpent.rows) farmRow(row.client_id, row.currency).spent = Number(row.spent);
  const byFarm = [...farms.values()].map((row) => ({
    ...row,
    profit: Math.round((row.income - row.spent) * 100) / 100
  }));

  // Per crop planting or animal group: its sales, income, costs and profit.
  const productionMoney = await query(
    `SELECT p.client_id, x.currency, sum(x.sold) AS sold, sum(x.income) AS income, sum(x.spent) AS spent
     FROM productions p
     JOIN (
       SELECT s.production_id, s.currency, s.total_amount AS sold, 0 AS income, 0 AS spent
       FROM sales s
       WHERE s.farmer_id = $1 AND s.deleted_at IS NULL AND s.production_id IS NOT NULL
         AND ($2::date IS NULL OR s.sale_date >= $2) AND ($3::date IS NULL OR s.sale_date <= $3)
       UNION ALL
       SELECT s.production_id, s.currency, 0, p2.amount, 0
       FROM payments p2 JOIN sales s ON s.id = p2.sale_id
       WHERE p2.farmer_id = $1 AND p2.deleted_at IS NULL AND s.deleted_at IS NULL AND s.production_id IS NOT NULL
         AND ($2::date IS NULL OR p2.paid_date >= $2) AND ($3::date IS NULL OR p2.paid_date <= $3)
       UNION ALL
       SELECT e.production_id, e.currency, 0, 0, e.amount
       FROM expenses e
       WHERE e.farmer_id = $1 AND e.deleted_at IS NULL AND e.production_id IS NOT NULL
         AND ($2::date IS NULL OR e.expense_date >= $2) AND ($3::date IS NULL OR e.expense_date <= $3)
     ) x ON x.production_id = p.id
     WHERE p.deleted_at IS NULL
     GROUP BY p.client_id, x.currency`,
    [farmerId, from, to]
  );
  const byProduction = productionMoney.rows
    .map((row) => ({
      productionClientId: row.client_id,
      currency: row.currency,
      sold: Number(row.sold),
      income: Number(row.income),
      spent: Number(row.spent),
      profit: Math.round((Number(row.income) - Number(row.spent)) * 100) / 100
    }))
    .filter((row) => row.sold || row.income || row.spent);

  return { ...totals, counts: counts.rows[0], byFarm, byBatch, byProduction };
}
