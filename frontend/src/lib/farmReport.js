// The farmer's report: one summary of a chosen time (and farm), built on the
// phone from the saved records so it works without network. The same report
// object feeds the screen, the CSV file and the PDF file, so all three always
// show the same numbers. Money rules are the ones in ledger.js:
//   total sales    = what sales in the period were worth
//   total income   = money received in the period
//   total expenses = money spent in the period
//   profit         = income − expenses
// Liberian and US dollars are never added together.

import { activityMeta } from "./labels.js";
import { batchStatus, farmMoney, moneySummary, productionMoney, saleStatus } from "./ledger.js";
import { ANIMAL_ADD_EVENTS, animalCount, productionTitle } from "./production.js";
import { BUYER_TYPES, EXPENSE_CATEGORIES, optionFor, unitText } from "./words.js";

const pad = (value) => String(value).padStart(2, "0");
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const round = (value) => Math.round(value * 100) / 100;

export const REPORT_PERIODS = [
  { value: "month", text: "This month", say: "This month." },
  { value: "lastMonth", text: "Last month", say: "Last month." },
  { value: "year", text: "This year", say: "This year." },
  { value: "lastYear", text: "Last year", say: "Last year." },
  { value: "all", text: "All time", say: "All the time." },
  { value: "custom", text: "Pick days", say: "Pick the first day and the last day." }
];

export function reportPeriod(choice, custom = {}, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (choice) {
    case "month":
      return { from: iso(new Date(y, m, 1)), to: iso(today) };
    case "lastMonth":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "year":
      return { from: `${y}-01-01`, to: iso(today) };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "custom": {
      const from = custom.from || "";
      const to = custom.to || "";
      return from && to && from > to ? { from: to, to: from } : { from: from || undefined, to: to || undefined };
    }
    default:
      return {};
  }
}

export function longDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function periodText(choice, period) {
  const name = REPORT_PERIODS.find((item) => item.value === choice)?.text || "";
  if (!period.from && !period.to) return "All time";
  const range = `${longDate(period.from) || "start"} to ${longDate(period.to) || "today"}`;
  return choice === "custom" ? range : `${name} (${range})`;
}

function inRange(value, { from, to } = {}) {
  if (!value) return false;
  const day = String(value).slice(0, 10);
  return !(from && day < from) && !(to && day > to);
}

// Only what belongs to one farm: its harvests, the sales and costs from them,
// its plantings and animal groups, and its work.
export function recordsForFarm(farm, records, activities = []) {
  if (!farm) return { records, activities };
  const key = farm.clientId;
  const productions = (records.productions || []).filter((item) => item.farmClientId === key);
  const productionIds = new Set(productions.map((item) => item.clientId));
  const harvests = (records.harvests || []).filter((item) => item.farmClientId === key);
  const harvestIds = new Set(harvests.map((item) => item.clientId));
  const fromFarm = (item) =>
    harvestIds.has(item.harvestClientId) || productionIds.has(item.productionClientId);
  const sales = (records.sales || []).filter(fromFarm);
  const saleIds = new Set(sales.map((item) => item.clientId));
  return {
    records: {
      ...records,
      productions,
      animalEvents: (records.animalEvents || []).filter((item) => productionIds.has(item.productionClientId)),
      harvests,
      inspections: (records.inspections || []).filter((item) => harvestIds.has(item.harvestClientId)),
      sales,
      payments: (records.payments || []).filter((item) => saleIds.has(item.saleClientId)),
      expenses: (records.expenses || []).filter((item) => item.farmClientId === key || fromFarm(item))
    },
    activities: activities.filter((item) => item.farmId === farm.id || item.farmClientId === key)
  };
}

export function buildFarmerReport({ user = {}, farms = [], records, activities = [], choice = "year", custom = {}, farm = null, now = new Date() }) {
  const period = reportPeriod(choice, custom, now);
  const scoped = recordsForFarm(farm, records, activities);
  const data = {
    productions: [],
    animalEvents: [],
    harvests: [],
    inspections: [],
    buyers: [],
    sales: [],
    payments: [],
    expenses: [],
    ...scoped.records
  };
  const farmName = (clientId) => farms.find((item) => item.clientId === clientId)?.farmName || "";
  const productions = new Map(data.productions.map((item) => [item.clientId, item]));
  const harvests = new Map(data.harvests.map((item) => [item.clientId, item]));
  const buyers = new Map((records.buyers || []).map((item) => [item.clientId, item]));

  const summary = moneySummary(data, period);
  const currencies = ["LRD", "USD"].filter((currency) =>
    ["sold", "received", "spent"].some((field) => summary[field][currency] !== 0)
  );
  const totals = {};
  for (const currency of currencies.length ? currencies : ["LRD"]) {
    totals[currency] = {
      sold: summary.sold[currency],
      income: summary.income[currency],
      spent: summary.spent[currency],
      profit: summary.profit[currency]
    };
  }

  const byFarm = farmMoney(data, period)
    .map((row) => ({ ...row, name: farmName(row.farmClientId) || "Farm" }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.currency.localeCompare(b.currency));

  const byProduction = productionMoney(data, period)
    .map((row) => {
      const production = productions.get(row.productionClientId);
      return {
        ...row,
        name: production ? productionTitle(production) : "Crop or animals",
        kind: production?.productionKind === "animal" ? "Animals" : "Crop",
        farm: farmName(production?.farmClientId)
      };
    })
    .sort((a, b) => b.income - a.income || a.name.localeCompare(b.name));

  const spentTotals = summary.spent;
  const costsByCategory = summary.spentByCategory.map((row) => ({
    ...row,
    name: optionFor(EXPENSE_CATEGORIES, row.category)?.text || row.category,
    share: spentTotals[row.currency] ? Math.round((row.total / spentTotals[row.currency]) * 100) : 0
  }));

  // Harvests in the period, added up per crop and unit (bags and kilo are
  // never added together).
  const harvestRows = new Map();
  for (const harvest of data.harvests) {
    if (!inRange(harvest.harvestDate, period)) continue;
    const key = `${harvest.crop}:${harvest.unit}`;
    if (!harvestRows.has(key)) harvestRows.set(key, { crop: harvest.crop, unit: unitText(harvest.unit), batches: 0, harvested: 0, sold: 0, left: 0 });
    const row = harvestRows.get(key);
    const status = batchStatus(harvest, data.sales, data.inspections);
    row.batches += 1;
    row.harvested = round(row.harvested + Number(harvest.quantity || 0));
    row.sold = round(row.sold + status.sold);
    row.left = round(row.left + status.remaining);
  }
  const harvestSummary = [...harvestRows.values()].sort((a, b) => a.crop.localeCompare(b.crop));

  // Animal groups: what changed in the period, and how many there are now.
  const animals = data.productions
    .filter((item) => item.productionKind === "animal")
    .map((group) => {
      const events = data.animalEvents.filter((event) => event.productionClientId === group.clientId);
      const within = events.filter((event) => inRange(event.eventDate, period));
      const total = (types) =>
        within.filter((event) => types.includes(event.eventType)).reduce((sum, event) => sum + Number(event.quantity || 0), 0);
      return {
        name: productionTitle(group),
        farm: farmName(group.farmClientId),
        status: group.status === "finished" ? "Finished" : "Active",
        added: total(ANIMAL_ADD_EVENTS),
        died: total(["died"]),
        sold: total(["sold"]),
        otherOut: total(["eaten", "given_out"]),
        now: animalCount(group, events)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const crops = data.productions
    .filter((item) => item.productionKind !== "animal" && (inRange(item.startDate, period) || item.status === "active"))
    .map((item) => ({
      name: productionTitle(item),
      farm: farmName(item.farmClientId),
      planted: item.startDate,
      place: item.plot || "",
      status: item.status === "finished" ? "Finished" : "Active"
    }))
    .sort((a, b) => String(b.planted).localeCompare(String(a.planted)));

  const workCounts = new Map();
  let workTotal = 0;
  for (const activity of scoped.activities) {
    if (!inRange(activity.activityDate, period)) continue;
    workTotal += 1;
    const label = activityMeta(activity.activityType).label;
    workCounts.set(label, (workCounts.get(label) || 0) + 1);
  }
  const work = [...workCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Something taken from one production and used by another: dung from the
  // animals used as fertilizer, or crop leftovers used as animal feed.
  const allProductions = new Map((records.productions || []).map((item) => [item.clientId, item]));
  const resourceMovements = scoped.activities
    .filter((activity) => activity.sourceProductionClientId && inRange(activity.activityDate, period))
    .map((activity) => {
      const source = allProductions.get(activity.sourceProductionClientId);
      const target = allProductions.get(activity.productionClientId);
      return {
        date: activity.activityDate,
        what: activity.activityType === "feeding" ? "Crop leftovers for feed" : "Animal manure for fertilizer",
        from: source ? productionTitle(source) : "Other production",
        to: target ? productionTitle(target) : "This farm",
        quantity:
          activity.quantity === null || activity.quantity === undefined
            ? ""
            : `${activity.quantity}${activity.unit ? ` ${activity.unit}` : ""}`
      };
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const sales = data.sales
    .filter((sale) => inRange(sale.saleDate, period))
    .sort((a, b) => String(a.saleDate).localeCompare(String(b.saleDate)))
    .map((sale) => {
      const status = saleStatus(sale, data.payments);
      const buyer = buyers.get(sale.buyerClientId);
      const harvest = harvests.get(sale.harvestClientId);
      const production = productions.get(sale.productionClientId || harvest?.productionClientId);
      return {
        date: sale.saleDate,
        item: sale.crop,
        quantity: Number(sale.quantity || 0),
        unit: unitText(sale.unit),
        buyer: buyer ? buyer.name || optionFor(BUYER_TYPES, buyer.buyerType)?.text || "" : "",
        farm: farmName(harvest?.farmClientId || production?.farmClientId),
        currency: sale.currency,
        total: Number(sale.totalAmount || 0),
        paid: status.paid,
        toPay: status.owed
      };
    });

  const expenses = data.expenses
    .filter((expense) => inRange(expense.expenseDate, period))
    .sort((a, b) => String(a.expenseDate).localeCompare(String(b.expenseDate)))
    .map((expense) => {
      const harvest = harvests.get(expense.harvestClientId);
      const production = productions.get(expense.productionClientId || harvest?.productionClientId);
      return {
        date: expense.expenseDate,
        category: optionFor(EXPENSE_CATEGORIES, expense.category)?.text || expense.category,
        farm: farmName(expense.farmClientId || harvest?.farmClientId || production?.farmClientId) || "All farms",
        forWhat: production ? productionTitle(production) : harvest ? `${harvest.crop} harvest` : "",
        currency: expense.currency,
        amount: Number(expense.amount || 0),
        notes: expense.notes || ""
      };
    });

  return {
    farmer: {
      name: user.fullName || "",
      phone: user.phoneNumber || "",
      place: [user.community, user.district, user.county].filter(Boolean).join(", ")
    },
    scope: farm ? farm.farmName : "All my farms",
    choice,
    period,
    periodText: periodText(choice, period),
    madeOn: now.toISOString(),
    currencies: Object.keys(totals),
    totals,
    counts: {
      farms: farm ? 1 : farms.length,
      sales: sales.length,
      expenses: expenses.length,
      harvests: harvestSummary.reduce((sum, row) => sum + row.batches, 0),
      work: workTotal,
      crops: crops.length,
      animalGroups: animals.length
    },
    byFarm: farm ? [] : byFarm,
    byProduction,
    costsByCategory,
    harvests: harvestSummary,
    crops,
    animals,
    work,
    resourceMovements,
    sales,
    expenses
  };
}

export function reportFileName(report, extension) {
  const slug = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = ["farm-report", slug(report.farmer.name), report.scope === "All my farms" ? "" : slug(report.scope)];
  parts.push(report.period.from || report.period.to ? `${report.period.from || "start"}_to_${report.period.to || "today"}` : "all-time");
  return `${parts.filter(Boolean).join("-")}.${extension}`;
}
