// Season compare: this season next to the one before, crop by crop and
// animal group by animal group. Worked out on the phone from the farmer's own
// records, so it works without network.
//
// Money follows the same rules as everywhere else in the app (ledger.js):
//   money in = payments received in the period (by payment day)
//   costs    = expenses in the period
//   profit   = money in − costs
// Liberian and US dollars are never added together.

import { formatMoney } from "./ledger.js";

export const COMPARE_CHOICES = [
  { value: "season", label: "Season", hint: "Last 6 months and the 6 months before" },
  { value: "year", label: "Year", hint: "This year so far and the same time last year" }
];

const CURRENCIES = ["LRD", "USD"];
const OTHER_KEY = "__other__";
const OTHER_NAME = "Costs not tied to a crop or animal";

const pad = (value) => String(value).padStart(2, "0");
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const round = (value) => Math.round(value * 100) / 100;
const zero = () => ({ LRD: 0, USD: 0 });

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  return next;
}

function monthLabel(from, to) {
  const parts = (value) => {
    const date = new Date(`${value}T00:00:00`);
    return { month: date.toLocaleDateString("en-GB", { month: "short" }), year: date.getFullYear() };
  };
  const a = parts(from);
  const b = parts(to);
  return a.year === b.year ? `${a.month} – ${b.month} ${b.year}` : `${a.month} ${a.year} – ${b.month} ${b.year}`;
}

// The two periods to set side by side.
export function comparePeriods(choice = "season", today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (choice === "year") {
    const currentFrom = new Date(end.getFullYear(), 0, 1);
    const previousFrom = new Date(end.getFullYear() - 1, 0, 1);
    const previousTo = addMonths(end, -12);
    return {
      choice,
      current: { from: iso(currentFrom), to: iso(end), label: `${end.getFullYear()} so far`, short: "This year" },
      previous: {
        from: iso(previousFrom),
        to: iso(previousTo),
        label: `Same time ${end.getFullYear() - 1}`,
        short: "Last year"
      }
    };
  }
  const currentFrom = addDays(addMonths(end, -6), 1);
  const previousTo = addDays(currentFrom, -1);
  const previousFrom = addDays(addMonths(previousTo, -6), 1);
  return {
    choice: "season",
    current: {
      from: iso(currentFrom),
      to: iso(end),
      label: monthLabel(iso(currentFrom), iso(end)),
      short: "This season"
    },
    previous: {
      from: iso(previousFrom),
      to: iso(previousTo),
      label: monthLabel(iso(previousFrom), iso(previousTo)),
      short: "Season before"
    }
  };
}

function within(day, period) {
  if (!day) return false;
  const value = String(day).slice(0, 10);
  return value >= period.from && value <= period.to;
}

function emptyStats() {
  return {
    harvests: 0,
    quantities: {},
    sold: zero(),
    received: zero(),
    spent: zero(),
    profit: zero(),
    checks: 0,
    gradeA: 0,
    animalsLost: 0,
    records: 0
  };
}

function tidyName(name) {
  const text = String(name || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

// Compares two periods. `records` is the grouped list from useFarmerData():
// { productions, animalEvents, harvests, inspections, sales, payments, expenses }.
export function compareSeasons(records, periods) {
  const productions = new Map((records.productions || []).map((item) => [item.clientId, item]));
  const harvests = new Map((records.harvests || []).map((item) => [item.clientId, item]));
  const sales = new Map((records.sales || []).map((item) => [item.clientId, item]));

  const productionName = (clientId) => productions.get(clientId)?.name || null;
  const harvestName = (clientId) => {
    const harvest = harvests.get(clientId);
    return harvest ? productionName(harvest.productionClientId) || harvest.crop : null;
  };
  const saleName = (sale) =>
    productionName(sale.productionClientId) || harvestName(sale.harvestClientId) || sale.crop || null;

  const rows = new Map();
  const rowFor = (name, kind) => {
    const key = name ? String(name).trim().toLowerCase() : OTHER_KEY;
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        name: name ? tidyName(name) : OTHER_NAME,
        kind: name ? kind || "crop" : "other",
        current: emptyStats(),
        previous: emptyStats()
      });
    }
    const row = rows.get(key);
    if (kind === "animal") row.kind = "animal";
    return row;
  };
  const kindOf = (productionClientId) => productions.get(productionClientId)?.productionKind || null;
  const sides = (day) =>
    [within(day, periods.current) && "current", within(day, periods.previous) && "previous"].filter(Boolean);

  for (const harvest of records.harvests || []) {
    for (const side of sides(harvest.harvestDate)) {
      const stats = rowFor(harvestName(harvest.clientId), kindOf(harvest.productionClientId))[side];
      stats.harvests += 1;
      stats.records += 1;
      const unit = harvest.unit || "units";
      stats.quantities[unit] = round((stats.quantities[unit] || 0) + Number(harvest.quantity || 0));
    }
  }
  for (const check of records.inspections || []) {
    const harvest = harvests.get(check.harvestClientId);
    if (!harvest) continue;
    for (const side of sides(check.inspectionDate)) {
      const stats = rowFor(harvestName(harvest.clientId), kindOf(harvest.productionClientId))[side];
      stats.checks += 1;
      if (check.grade === "A") stats.gradeA += 1;
    }
  }
  for (const sale of records.sales || []) {
    for (const side of sides(sale.saleDate)) {
      const stats = rowFor(saleName(sale), kindOf(sale.productionClientId))[side];
      stats.sold[sale.currency] = round(stats.sold[sale.currency] + Number(sale.totalAmount || 0));
      stats.records += 1;
    }
  }
  for (const payment of records.payments || []) {
    const sale = sales.get(payment.saleClientId);
    if (!sale) continue;
    for (const side of sides(payment.paidDate)) {
      const stats = rowFor(saleName(sale), kindOf(sale.productionClientId))[side];
      stats.received[sale.currency] = round(stats.received[sale.currency] + Number(payment.amount || 0));
    }
  }
  for (const expense of records.expenses || []) {
    const name = productionName(expense.productionClientId) || harvestName(expense.harvestClientId);
    for (const side of sides(expense.expenseDate)) {
      const stats = rowFor(name, kindOf(expense.productionClientId))[side];
      stats.spent[expense.currency] = round(stats.spent[expense.currency] + Number(expense.amount || 0));
      stats.records += 1;
    }
  }
  for (const event of records.animalEvents || []) {
    if (event.eventType !== "died") continue;
    const name = productionName(event.productionClientId);
    if (!name) continue;
    for (const side of sides(event.eventDate)) {
      const stats = rowFor(name, "animal")[side];
      stats.animalsLost += Number(event.quantity || 0);
      stats.records += 1;
    }
  }

  const finish = (stats, unit) => {
    for (const currency of CURRENCIES) stats.profit[currency] = round(stats.received[currency] - stats.spent[currency]);
    stats.harvest = unit ? { quantity: stats.quantities[unit] || 0, unit } : null;
    stats.gradeAShare = stats.checks ? stats.gradeA / stats.checks : null;
    return stats;
  };

  const list = [...rows.values()].map((row) => {
    // One unit per row, the one used most, so the two sides compare like with like.
    const totals = {};
    for (const side of [row.current, row.previous]) {
      for (const [unit, quantity] of Object.entries(side.quantities)) totals[unit] = (totals[unit] || 0) + quantity;
    }
    const unit = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const mixedUnits = Object.keys(totals).length > 1;
    finish(row.current, unit);
    finish(row.previous, unit);
    return { ...row, mixedUnits, isNew: row.previous.records === 0 && row.current.records > 0 };
  });

  const active = (stats) => stats.records > 0 || CURRENCIES.some((c) => stats.received[c] || stats.spent[c]);
  const visible = list
    .filter((row) => active(row.current) || active(row.previous))
    .sort((a, b) => {
      if (a.key === OTHER_KEY) return 1;
      if (b.key === OTHER_KEY) return -1;
      const weight = (row) => Math.abs(row.current.profit.LRD) + Math.abs(row.previous.profit.LRD) + 150 * (Math.abs(row.current.profit.USD) + Math.abs(row.previous.profit.USD));
      return weight(b) - weight(a) || a.name.localeCompare(b.name);
    });

  const totals = { current: emptyStats(), previous: emptyStats() };
  for (const row of visible) {
    for (const side of ["current", "previous"]) {
      for (const field of ["sold", "received", "spent", "profit"]) {
        for (const currency of CURRENCIES) {
          totals[side][field][currency] = round(totals[side][field][currency] + row[side][field][currency]);
        }
      }
      totals[side].harvests += row[side].harvests;
      totals[side].records += row[side].records;
      totals[side].animalsLost += row[side].animalsLost;
    }
  }

  const currencies = CURRENCIES.filter((currency) =>
    ["current", "previous"].some((side) => ["received", "spent", "sold"].some((field) => totals[side][field][currency]))
  );

  return {
    periods,
    rows: visible,
    totals,
    currencies: currencies.length ? currencies : ["LRD"],
    insights: insightsFor(visible, totals, currencies.length ? currencies : ["LRD"], periods),
    hasPrevious: totals.previous.records > 0 || CURRENCIES.some((c) => totals.previous.received[c]),
    hasCurrent: totals.current.records > 0 || CURRENCIES.some((c) => totals.current.received[c])
  };
}

function sayAmount(amount, currency) {
  return `${Math.abs(amount).toLocaleString("en-US")} ${currency === "USD" ? "US dollars" : "Liberian dollars"}`;
}

// Up to three plain sentences about the biggest changes, for the top of the
// screen and for the voice.
function insightsFor(rows, totals, currencies, periods) {
  const against = periods.choice === "year" ? "the same time last year" : "the season before";
  const out = [];
  for (const currency of currencies) {
    const now = totals.current.profit[currency];
    const before = totals.previous.profit[currency];
    if (now === before || (!now && !before)) continue;
    const diff = round(now - before);
    out.push({
      tone: diff > 0 ? "up" : "down",
      weight: Infinity,
      text: `Total profit ${diff > 0 ? "up" : "down"} ${formatMoney(Math.abs(diff), currency)} on ${against}.`,
      say: `Your total profit is ${diff > 0 ? "up" : "down"} ${sayAmount(diff, currency)} on ${against}.`
    });
  }
  const candidates = [];
  for (const row of rows) {
    if (row.kind === "other") continue;
    for (const currency of currencies) {
      const now = row.current.profit[currency];
      const before = row.previous.profit[currency];
      const diff = round(now - before);
      if (!diff) continue;
      if (row.isNew) {
        candidates.push({
          tone: now >= 0 ? "up" : "down",
          weight: Math.abs(diff) * (currency === "USD" ? 150 : 1),
          text: `${row.name} is new: ${formatMoney(now, currency)} profit so far.`,
          say: `${row.name} is new this time, with ${now < 0 ? "a loss of " : ""}${sayAmount(now, currency)}${now < 0 ? "" : " profit"} so far.`
        });
      } else {
        candidates.push({
          tone: diff > 0 ? "up" : "down",
          weight: Math.abs(diff) * (currency === "USD" ? 150 : 1),
          text: `${row.name}: profit ${diff > 0 ? "up" : "down"} ${formatMoney(Math.abs(diff), currency)}.`,
          say: `${row.name} profit is ${diff > 0 ? "up" : "down"} ${sayAmount(diff, currency)}.`
        });
      }
    }
    const a = row.current.harvest;
    const b = row.previous.harvest;
    if (a && b && !row.isNew && a.quantity > 0 && b.quantity > 0 && a.quantity !== b.quantity && !row.mixedUnits) {
      const change = a.quantity - b.quantity;
      const percent = Math.round((Math.abs(change) / b.quantity) * 100);
      if (percent >= 10) {
        candidates.push({
          tone: change > 0 ? "up" : "down",
          weight: percent * 50,
          text: `${row.name}: harvest ${change > 0 ? "up" : "down"} ${percent}% (${a.quantity} ${a.unit} against ${b.quantity}).`,
          say: `${row.name} harvest is ${change > 0 ? "up" : "down"} ${percent} percent.`
        });
      }
    }
    if (row.kind === "animal" && row.current.animalsLost > row.previous.animalsLost && row.current.animalsLost >= 2) {
      candidates.push({
        tone: "down",
        weight: row.current.animalsLost * 500,
        text: `${row.name}: ${row.current.animalsLost} died, against ${row.previous.animalsLost} before.`,
        say: `${row.current.animalsLost} ${row.name.toLowerCase()} died this time, against ${row.previous.animalsLost} before. Check their health.`
      });
    }
  }
  candidates.sort((x, y) => y.weight - x.weight);
  return [...out, ...candidates].slice(0, 3).map(({ tone, text, say }) => ({ tone, text, say }));
}

// Change from before to now, for the arrows: "up", "down" or "same".
export function trend(now, before) {
  if (now === before) return "same";
  return now > before ? "up" : "down";
}
