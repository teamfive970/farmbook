// Money and harvest numbers worked out on the phone, so they show offline.
// Same rules as the server report (backend/src/services/reportService.js):
// Liberian and US dollars are never added together.

export const CURRENCY_LABEL = { LRD: "L$", USD: "US$" };

export function formatMoney(amount, currency) {
  const value = Number(amount || 0);
  const shown = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
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

// A harvest batch: how much was sold from it, how much is left, its grade.
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
  const salesByClientId = new Map(records.sales.map((sale) => [sale.clientId, sale]));

  for (const sale of records.sales) {
    if (!inRange(sale.saleDate, period)) continue;
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
    spent[expense.currency] = round(spent[expense.currency] + Number(expense.amount || 0));
    const key = `${expense.category}:${expense.currency}`;
    byCategory[key] = round((byCategory[key] || 0) + Number(expense.amount || 0));
  }
  return {
    sold,
    received,
    owed,
    spent,
    profit: { LRD: round(received.LRD - spent.LRD), USD: round(received.USD - spent.USD) },
    spentByCategory: Object.entries(byCategory).map(([key, total]) => {
      const [category, currency] = key.split(":");
      return { category, currency, total };
    })
  };
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
    ["sold", "received", "owed", "spent"].some((field) => summary[field][currency] !== 0)
  );
  return used.length ? used : ["LRD"];
}
