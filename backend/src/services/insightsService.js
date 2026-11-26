import { createHash } from "node:crypto";
import { query } from "../config/database.js";
import { getMarketPrices } from "./marketService.js";
import { moneyAndHarvestTotals } from "./reportService.js";

// "My farm insights": what changed on the farm this season, in plain words.
//
// 1. Facts are worked out from the farmer's own records: this season (the last
//    6 months) next to the 6 months before, plus their sale prices next to the
//    county market price.
// 2. Simple rules turn the facts into short sentences. This always works.
// 3. If ANTHROPIC_API_KEY is set, an AI model also writes a short summary
//    from the same facts. It is given numbers only (no name, phone or place
//    below county), told to use only those numbers, and its answer is shown
//    as "written by AI". If the AI is slow or off, the rules are enough.

const CURRENCY = { LRD: "L$", USD: "US$" };
const CATEGORY = {
  seeds: "seed",
  fertilizer: "fertilizer",
  pesticide: "spray (pesticide)",
  labour: "labour",
  tools: "tools",
  transport: "transport",
  feed: "animal feed",
  medicine: "animal medicine",
  land: "land",
  other: "other costs"
};

const iso = (date) => date.toISOString().slice(0, 10);
const money = (amount, currency) => `${CURRENCY[currency]}${Math.round(amount).toLocaleString("en-US")}`;
const pct = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
const unitWord = (unit) => String(unit || "").replace(/s$/, "");

export function seasonRanges(today = new Date()) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 6);
  start.setUTCDate(start.getUTCDate() + 1);
  const beforeEnd = new Date(start);
  beforeEnd.setUTCDate(beforeEnd.getUTCDate() - 1);
  const beforeStart = new Date(start);
  beforeStart.setUTCMonth(beforeStart.getUTCMonth() - 6);
  return {
    now: { from: iso(start), to: iso(end) },
    before: { from: iso(beforeStart), to: iso(beforeEnd) }
  };
}

// Everything the sentences (and the AI) are allowed to use.
export async function buildFacts(farmerId, today = new Date()) {
  const ranges = seasonRanges(today);
  const [now, before, farmer, work, prices] = await Promise.all([
    moneyAndHarvestTotals(farmerId, ranges.now),
    moneyAndHarvestTotals(farmerId, ranges.before),
    query("SELECT county FROM farmers WHERE id = $1", [farmerId]),
    query(
      `SELECT
         count(*) FILTER (WHERE activity_date BETWEEN $2 AND $3)::int AS now,
         count(*) FILTER (WHERE activity_date BETWEEN $4 AND $5)::int AS before,
         max(activity_date) AS last
       FROM farm_activities WHERE farmer_id = $1 AND deleted_at IS NULL`,
      [farmerId, ranges.now.from, ranges.now.to, ranges.before.from, ranges.before.to]
    ),
    query(
      `SELECT lower(trim(crop)) AS crop, unit, currency,
              sum(COALESCE(unit_price * quantity, total_amount)) / NULLIF(sum(quantity), 0) AS price,
              count(*)::int AS sales
       FROM sales
       WHERE farmer_id = $1 AND deleted_at IS NULL AND sale_date BETWEEN $2 AND $3 AND quantity > 0
       GROUP BY 1, 2, 3`,
      [farmerId, ranges.now.from, ranges.now.to]
    )
  ]);
  const county = farmer.rows[0]?.county || null;

  const costs = {};
  for (const [label, totals] of [
    ["now", now],
    ["before", before]
  ]) {
    for (const row of totals.spentByCategory) {
      const key = `${row.category}|${row.currency}`;
      costs[key] ||= { category: row.category, currency: row.currency, now: 0, before: 0 };
      costs[key][label] += row.total;
    }
  }

  const harvest = {};
  for (const [label, totals] of [
    ["now", now],
    ["before", before]
  ]) {
    for (const row of totals.harvest) {
      const key = `${row.crop.toLowerCase()}|${row.unit}`;
      harvest[key] ||= { crop: row.crop, unit: row.unit, now: 0, before: 0 };
      harvest[key][label] += row.quantity;
    }
  }

  let market = { prices: [] };
  if (prices.rows.length && county) {
    market = await getMarketPrices({ county }).catch(() => ({ prices: [] }));
  }
  const priceCompare = prices.rows
    .map((row) => {
      const match = market.prices.find(
        (item) => item.crop.toLowerCase() === row.crop && item.unit === row.unit && item.currency === row.currency
      );
      return {
        crop: row.crop,
        unit: row.unit,
        currency: row.currency,
        myPrice: Math.round(Number(row.price) * 100) / 100,
        marketPrice: match ? match.median : null,
        sales: row.sales
      };
    })
    .filter((row) => Number.isFinite(row.myPrice));

  return {
    county,
    periods: ranges,
    money: {
      now: { in: now.money.received, costs: now.money.spent, profit: now.money.profit },
      before: { in: before.money.received, costs: before.money.spent, profit: before.money.profit }
    },
    costs: Object.values(costs),
    harvest: Object.values(harvest),
    prices: priceCompare,
    work: {
      now: work.rows[0]?.now ?? 0,
      before: work.rows[0]?.before ?? 0,
      lastRecord: work.rows[0]?.last ? iso(new Date(work.rows[0].last)) : null
    }
  };
}

// Plain sentences from the facts, most useful first.
export function ruleInsights(facts, today = new Date()) {
  const out = [];
  const add = (key, level, text, weight) => out.push({ key, level, text, say: text, weight });

  for (const currency of ["LRD", "USD"]) {
    const nowP = facts.money.now.profit[currency];
    const beforeP = facts.money.before.profit[currency];
    const nowIn = facts.money.now.in[currency];
    const nowCost = facts.money.now.costs[currency];
    if (!nowIn && !nowCost && !facts.money.before.in[currency] && !facts.money.before.costs[currency]) continue;
    if (nowIn || nowCost) {
      if (nowP >= 0) {
        add(`profit_${currency}`, "good", `This season you made a profit of ${money(nowP, currency)}: ${money(nowIn, currency)} came in and ${money(nowCost, currency)} went out.`, 90);
      } else {
        add(`profit_${currency}`, "warning", `This season you spent ${money(-nowP, currency)} more than came in (${money(nowCost, currency)} out, ${money(nowIn, currency)} in). Money may still come when you sell.`, 95);
      }
    }
    const change = pct(nowP, Math.abs(beforeP));
    if (beforeP > 0 && change !== null && Math.abs(change) >= 10) {
      add(
        `profit_change_${currency}`,
        change > 0 ? "good" : "warning",
        change > 0
          ? `Your profit is ${change}% higher than last season (${money(beforeP, currency)} before).`
          : `Your profit is ${Math.abs(change)}% lower than last season (${money(beforeP, currency)} before).`,
        80
      );
    }
  }

  const costChanges = facts.costs
    .map((row) => ({ ...row, change: pct(row.now, row.before) }))
    .filter((row) => row.before > 0 && row.now > 0 && row.change !== null && Math.abs(row.change) >= 20)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before));
  for (const row of costChanges.slice(0, 2)) {
    const what = CATEGORY[row.category] || row.category;
    add(
      `cost_${row.category}_${row.currency}`,
      row.change > 0 ? "warning" : "good",
      row.change > 0
        ? `You spent ${row.change}% more on ${what} than last season (${money(row.now, row.currency)}, before ${money(row.before, row.currency)}).`
        : `You spent ${Math.abs(row.change)}% less on ${what} than last season (${money(row.now, row.currency)}, before ${money(row.before, row.currency)}).`,
      70
    );
  }

  for (const currency of ["LRD", "USD"]) {
    const rows = facts.costs.filter((row) => row.currency === currency && row.now > 0);
    const total = rows.reduce((sum, row) => sum + row.now, 0);
    const top = rows.sort((a, b) => b.now - a.now)[0];
    if (top && total > 0 && rows.length > 1 && top.now / total >= 0.4) {
      add(
        `top_cost_${currency}`,
        "info",
        `Your biggest cost this season is ${CATEGORY[top.category] || top.category}: ${Math.round((top.now / total) * 100)}% of all you spent in ${CURRENCY[currency]}.`,
        50
      );
    }
  }

  for (const row of facts.harvest) {
    const change = pct(row.now, row.before);
    if (row.before > 0 && row.now > 0 && change !== null && Math.abs(change) >= 10) {
      add(
        `harvest_${row.crop.toLowerCase()}`,
        change > 0 ? "good" : "warning",
        change > 0
          ? `You harvested ${change}% more ${row.crop} than last season: ${row.now} ${row.unit}, before ${row.before}.`
          : `You harvested ${Math.abs(change)}% less ${row.crop} than last season: ${row.now} ${row.unit}, before ${row.before}.`,
        75
      );
    }
  }

  for (const row of facts.prices) {
    if (!row.marketPrice) continue;
    const diff = pct(row.myPrice, row.marketPrice);
    const crop = row.crop.charAt(0).toUpperCase() + row.crop.slice(1);
    if (diff !== null && diff <= -10) {
      add(
        `price_${row.crop}`,
        "warning",
        `You sold ${crop} for about ${money(row.myPrice, row.currency)} per ${unitWord(row.unit)}. Farmers in ${facts.county} got about ${money(row.marketPrice, row.currency)}, so you sold ${Math.abs(diff)}% lower. Check market prices before you sell.`,
        85
      );
    } else if (diff !== null && diff >= 10) {
      add(
        `price_${row.crop}`,
        "good",
        `Good selling: your ${crop} price (${money(row.myPrice, row.currency)} per ${unitWord(row.unit)}) is ${diff}% above the usual price in ${facts.county}.`,
        60
      );
    }
  }

  if (facts.work.lastRecord) {
    const days = Math.floor((today - new Date(`${facts.work.lastRecord}T00:00:00Z`)) / 86400000);
    if (days >= 14) {
      add("work_gap", "info", `You have not recorded farm work for ${days} days. Records help you see what works.`, 40);
    }
  }
  if (facts.work.before > 0 && facts.work.now > 0) {
    const change = pct(facts.work.now, facts.work.before);
    if (change !== null && change <= -40) {
      add("work_less", "info", `You recorded ${facts.work.now} farm jobs this season, ${facts.work.before} the season before. Keep recording so your book stays complete.`, 30);
    }
  }

  if (!out.length) {
    add("start", "info", "Keep recording your work, harvests, sales and costs. After a few weeks FarmBok can show you what is changing on your farm.", 1);
  }
  return out.sort((a, b) => b.weight - a.weight).map(({ weight, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Optional AI summary
// ---------------------------------------------------------------------------

const aiCache = new Map();
const AI_TTL_MS = 12 * 60 * 60 * 1000;
let aiFetch = (url, options) => fetch(url, options);

export function setInsightsFetcher(fn) {
  aiFetch = fn || ((url, options) => fetch(url, options));
  aiCache.clear();
}

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.INSIGHTS_AI !== "off";
}

const SYSTEM = `You help smallholder farmers in Liberia understand their own farm records.
Write 3 to 5 short sentences in simple Liberian English that a farmer with little schooling can follow.
Use ONLY the numbers in the facts and the sentences given. Never invent numbers, prices, crops or advice that needs numbers you do not have.
Keep L$ and US$ apart; never add or convert them. Say "this season" for the last 6 months and "last season" for the 6 months before.
Start with the most important change. End with one practical, low-cost thing to try. No greetings, no lists, no markdown.`;

async function aiSummary(facts, insights) {
  const input = { facts: { ...facts, county: facts.county }, sentences: insights.map((item) => item.text) };
  const key = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const cached = aiCache.get(key);
  if (cached && Date.now() - cached.at < AI_TTL_MS) return cached.text;

  const response = await aiFetch(process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.INSIGHTS_MODEL || "claude-haiku-5-5",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: `Farm facts (JSON):\n${JSON.stringify(input)}` }]
    }),
    signal: AbortSignal.timeout(Number(process.env.INSIGHTS_AI_TIMEOUT_MS || 15000))
  });
  if (!response.ok) throw new Error(`AI answered ${response.status}`);
  const body = await response.json();
  const text = (body.content || [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("AI gave no text");
  aiCache.set(key, { at: Date.now(), text: text.slice(0, 1200) });
  return text.slice(0, 1200);
}

export async function getInsights(farmerId, { today = new Date() } = {}) {
  const facts = await buildFacts(farmerId, today);
  const insights = ruleInsights(facts, today);
  let summary = null;
  if (aiEnabled() && insights[0]?.key !== "start") {
    try {
      summary = { text: await aiSummary(facts, insights), by: "ai" };
    } catch (error) {
      console.warn("[insights] AI summary skipped:", error.message);
    }
  }
  return {
    periods: facts.periods,
    county: facts.county,
    insights,
    summary,
    generatedAt: new Date().toISOString()
  };
}
