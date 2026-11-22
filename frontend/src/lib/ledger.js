// Money and harvest numbers worked out on the phone, so they show offline.
// Same rules as the server report (backend/src/services/reportService.js),
// and a backend test checks both give the same numbers:
//   total sales    = value of sales made in the period (by sale day)
//   total income   = money actually received in the period (by payment day)
//   total expenses = farm costs in the period
//   profit         = income − expenses
// Liberian and US dollars are never added together.

export const CURRENCY_LABEL = { LRD: "L$", USD: "US$" };

export function formatMoney(amount, currency) {
  const value = Number(amount || 0);
  // Cents are shown as two places (US$12.50), whole amounts without them.
  const shown = Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${CURRENCY_LABEL[currency] || ""}${shown}`;
}

export function sayMoney(amount, currency) {
  const value = Number(amount || 0);
  return `${value.toLocaleString("en-US")} ${currency === "USD" ? "US dollars" : "Liberian dollars"}`;
}

function inRange(dateValue, { from, to } = {}) {
  if (!dateValue) return false;
  const day = String(dateValue).slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

const zero = () => ({ LRD: 0, USD: 0 });
const round = (value) => Math.round(value * 100) / 100;

export function paymentsForSale(sale, payments) {
  return payments.filter((payment) => payment.saleClientId === sale.clientId);
}

export function saleStatus(sale, payments) {
  const paid = round(paymentsForSale(sale, payments).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const total = Number(sale.totalAmount || 0);
  const owed = Math.max(round(total - paid), 0);
  return {
    paid,
    owed,
    total,
    state: paid <= 0 ? (total > 0 ? "not_paid" : "paid") : owed > 0 ? "part_paid" : "paid"
  };
}

export function latestInspection(harvest, inspections) {
  return inspections
    .filter((item) => item.harvestClientId === harvest.clientId)
    .sort(
      (a, b) =>
        String(b.inspectionDate).localeCompare(String(a.inspectionDate)) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )[0];
}

// A harvest batch: Amount was sold from it, Amount is left, its grade.
export function batchStatus(harvest, sales, inspections = []) {
  const linked = sales.filter((sale) => sale.harvestClientId === harvest.clientId);
  const sameUnit = linked.filter((sale) => sale.unit === harvest.unit);
  const sold = round(sameUnit.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0));
  const remaining = Math.max(round(Number(harvest.quantity || 0) - sold), 0);
  return {
    sales: linked,
    sold,
    remaining,
    state: sold <= 0 ? "in_store" : remaining > 0 ? "part_sold" : "sold_out",
    grade: latestInspection(harvest, inspections)?.grade || null
  };
}

export function moneySummary(records, period = {}) {
  const sold = zero();
  const received = zero();
  const owed = zero();
  const spent = zero();
  const counts = { sales: 0, expenses: 0, harvests: 0 };
  const salesByClientId = new Map(records.sales.map((sale) => [sale.clientId, sale]));

  for (const sale of records.sales) {
    if (!inRange(sale.saleDate, period)) continue;
    counts.sales += 1;
    sold[sale.currency] = round(sold[sale.currency] + Number(sale.totalAmount || 0));
    owed[sale.currency] = round(owed[sale.currency] + saleStatus(sale, records.payments).owed);
  }
  for (const payment of records.payments) {
    const sale = salesByClientId.get(payment.saleClientId);
    if (!sale || !inRange(payment.paidDate, period)) continue;
    received[sale.currency] = round(received[sale.currency] + Number(payment.amount || 0));
  }
  const byCategory = {};
  for (const expense of records.expenses) {
    if (!inRange(expense.expenseDate, period)) continue;
    counts.expenses += 1;
    spent[expense.currency] = round(spent[expense.currency] + Number(expense.amount || 0));
    const key = `${expense.category}:${expense.currency}`;
    byCategory[key] = round((byCategory[key] || 0) + Number(expense.amount || 0));
  }
  for (const harvest of records.harvests || []) {
    if (inRange(harvest.harvestDate, period)) counts.harvests += 1;
  }
  return {
    sold,
    received,
    income: { ...received },
    owed,
    spent,
    profit: { LRD: round(received.LRD - spent.LRD), USD: round(received.USD - spent.USD) },
    counts,
    spentByCategory: Object.entries(byCategory)
      .map(([key, total]) => {
        const [category, currency] = key.split(":");
        return { category, currency, total };
      })
      .sort((a, b) => b.total - a.total)
  };
}

// Money per farm: income from the sales of its harvests, minus the costs
// recorded for that farm. Costs not tied to a farm are left out here.
export function farmMoney(records, period = {}) {
  const harvestFarm = new Map((records.harvests || []).map((item) => [item.clientId, item.farmClientId]));
  const salesByClientId = new Map(records.sales.map((sale) => [sale.clientId, sale]));
  const rows = new Map();
  const row = (farmClientId, currency) => {
    const key = `${farmClientId}:${currency}`;
    if (!rows.has(key)) rows.set(key, { farmClientId, currency, sold: 0, income: 0, spent: 0 });
    return rows.get(key);
  };
  for (const sale of records.sales) {
    const farmClientId = harvestFarm.get(sale.harvestClientId);
    if (!farmClientId || !inRange(sale.saleDate, period)) continue;
    const target = row(farmClientId, sale.currency);
    target.sold = round(target.sold + Number(sale.totalAmount || 0));
  }
  for (const payment of records.payments) {
    const sale = salesByClientId.get(payment.saleClientId);
    const farmClientId = sale && harvestFarm.get(sale.harvestClientId);
    if (!farmClientId || !inRange(payment.paidDate, period)) continue;
    const target = row(farmClientId, sale.currency);
    target.income = round(target.income + Number(payment.amount || 0));
  }
  for (const expense of records.expenses) {
    if (!expense.farmClientId || !inRange(expense.expenseDate, period)) continue;
    const target = row(expense.farmClientId, expense.currency);
    target.spent = round(target.spent + Number(expense.amount || 0));
  }
  return [...rows.values()].map((item) => ({ ...item, profit: round(item.income - item.spent) }));
}

// Money per harvest batch: what its sales were worth, what came in, and the
// costs recorded for that batch. Profit = income − costs, like everywhere.
export function batchMoney(records, period = {}) {
  const harvests = new Map((records.harvests || []).map((item) => [item.clientId, item]));
  const salesByClientId = new Map(records.sales.map((sale) => [sale.clientId, sale]));
  const rows = new Map();
  const row = (harvest, currency) => {
    const key = `${harvest.clientId}:${currency}`;
    if (!rows.has(key)) {
      rows.set(key, {
        harvestClientId: harvest.clientId,
        farmClientId: harvest.farmClientId,
        crop: harvest.crop,
        currency,
        sold: 0,
        income: 0,
        spent: 0
      });
    }
    return rows.get(key);
  };
  for (const sale of records.sales) {
    const harvest = harvests.get(sale.harvestClientId);
    if (!harvest) continue;
    const target = row(harvest, sale.currency);
    if (inRange(sale.saleDate, period)) target.sold = round(target.sold + Number(sale.totalAmount || 0));
  }
  for (const expense of records.expenses) {
    const harvest = harvests.get(expense.harvestClientId);
    if (!harvest || !inRange(expense.expenseDate, period)) continue;
    const target = row(harvest, expense.currency);
    target.spent = round(target.spent + Number(expense.amount || 0));
  }
  for (const payment of records.payments) {
    const sale = salesByClientId.get(payment.saleClientId);
    const harvest = sale && harvests.get(sale.harvestClientId);
    if (!harvest || !inRange(payment.paidDate, period)) continue;
    const key = `${harvest.clientId}:${sale.currency}`;
    if (rows.has(key)) rows.get(key).income = round(rows.get(key).income + Number(payment.amount || 0));
  }
  return [...rows.values()]
    .map((item) => ({ ...item, profit: round(item.income - item.spent) }))
    .filter((item) => item.sold || item.income || item.spent);
}

// Money per crop planting or animal group (same rules as the server's
// byProduction): its sales, income, costs and profit. A sale or cost made
// from a harvest batch counts for that batch's planting or group.
export function productionMoney(records, period = {}) {
  const harvests = new Map((records.harvests || []).map((item) => [item.clientId, item]));
  const productionOf = (record) =>
    record.productionClientId || harvests.get(record.harvestClientId)?.productionClientId || null;
  const saleProduction = new Map(records.sales.map((sale) => [sale.clientId, { sale, production: productionOf(sale) }]));
  const rows = new Map();
  const row = (productionClientId, currency) => {
    const key = `${productionClientId}:${currency}`;
    if (!rows.has(key)) rows.set(key, { productionClientId, currency, sold: 0, income: 0, spent: 0 });
    return rows.get(key);
  };
  for (const { sale, production } of saleProduction.values()) {
    if (!production || !inRange(sale.saleDate, period)) continue;
    const target = row(production, sale.currency);
    target.sold = round(target.sold + Number(sale.totalAmount || 0));
  }
  for (const payment of records.payments) {
    const found = saleProduction.get(payment.saleClientId);
    if (!found?.production || !inRange(payment.paidDate, period)) continue;
    const target = row(found.production, found.sale.currency);
    target.income = round(target.income + Number(payment.amount || 0));
  }
  for (const expense of records.expenses) {
    const production = productionOf(expense);
    if (!production || !inRange(expense.expenseDate, period)) continue;
    const target = row(production, expense.currency);
    target.spent = round(target.spent + Number(expense.amount || 0));
  }
  return [...rows.values()]
    .map((item) => ({ ...item, profit: round(item.income - item.spent) }))
    .filter((item) => item.sold || item.income || item.spent);
}

export function periodFor(choice) {
  const today = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (choice === "month") return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
  if (choice === "year") return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
  return {};
}

export function usedCurrencies(summary) {
  const used = ["LRD", "USD"].filter((currency) =>
    ["sold", "received", "spent"].some((field) => summary[field][currency] !== 0)
  );
  return used.length ? used : ["LRD"];
}
