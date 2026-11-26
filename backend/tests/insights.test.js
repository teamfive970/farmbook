import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, query, resetDatabase, startServer } from "./helpers.js";
import { ruleInsights, seasonRanges, setInsightsFetcher } from "../src/services/insightsService.js";

let server;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

before(async () => {
  process.env.MARKET_MIN_FARMERS = "2";
  process.env.MARKET_MIN_SALES = "2";
  server = await startServer();
});
beforeEach(resetDatabase);
after(async () => {
  setInsightsFetcher(null);
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MARKET_MIN_FARMERS;
  delete process.env.MARKET_MIN_SALES;
  await server.close();
  await closeDatabase();
});

async function farmer(phoneNumber, county = "Bong") {
  const res = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Musu Kollie", phoneNumber, county, district: "D", community: "C", pin: "1122", confirmPin: "1122" }
  });
  const { rows } = await query("SELECT id FROM farmers WHERE phone_number = $1", [`+231${phoneNumber.slice(1)}`]);
  return { token: res.body.token, id: rows[0].id };
}

let n = 0;
async function expense(id, category, amount, date) {
  n += 1;
  await query(
    `INSERT INTO expenses (farmer_id, client_id, expense_date, category, amount, currency) VALUES ($1, $2, $3, $4, $5, 'LRD')`,
    [id, `exp-insight-${n}-xx`, date, category, amount]
  );
}
async function sale(id, crop, qty, price, date, paid = true) {
  n += 1;
  const { rows } = await query(
    `INSERT INTO sales (farmer_id, client_id, crop, quantity, unit, unit_price, total_amount, currency, sale_date)
     VALUES ($1, $2, $3, $4, 'bags', $5, $6, 'LRD', $7) RETURNING id, client_id`,
    [id, `sale-insight-${n}-xx`, crop, qty, price, qty * price, date]
  );
  if (paid) {
    await query(
      `INSERT INTO payments (farmer_id, client_id, sale_id, sale_client_id, amount, paid_date) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, `pay-insight-${n}-xx`, rows[0].id, rows[0].client_id, qty * price, date]
    );
  }
}

test("season ranges are 6 months each and do not overlap", () => {
  const r = seasonRanges(new Date("2026-11-26T10:00:00Z"));
  assert.deepEqual(r, { now: { from: "2026-05-27", to: "2026-11-26" }, before: { from: "2025-11-27", to: "2026-05-26" } });
});

test("insights explain profit, cost changes and selling below market", async () => {
  const me = await farmer("0775553001");
  const a = await farmer("0775553002");
  const b = await farmer("0775553003");
  // Market in Bong: rice at L$3,200 a bag.
  await sale(a.id, "Rice", 5, 3200, daysAgo(20));
  await sale(b.id, "Rice", 5, 3200, daysAgo(25));
  // Me: last season fertilizer L$1,000; this season L$1,500 (+50%), sold rice cheap.
  await expense(me.id, "fertilizer", 1000, daysAgo(250));
  await expense(me.id, "fertilizer", 1500, daysAgo(30));
  await expense(me.id, "labour", 500, daysAgo(40));
  await sale(me.id, "Rice", 10, 2700, daysAgo(10));
  await sale(me.id, "Rice", 4, 3000, daysAgo(220));

  const res = await api(server.baseUrl, "/api/insights", { token: me.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const byKey = Object.fromEntries(res.body.insights.map((item) => [item.key, item]));
  assert.match(byKey.profit_LRD.text, /profit of L\$25,000: L\$27,000 came in and L\$2,000 went out/);
  assert.match(byKey.cost_fertilizer_LRD.text, /50% more on fertilizer/);
  assert.match(byKey.price_rice.text, /about L\$2,700 per bag.*about L\$3,200.*16% lower/);
  assert.equal(byKey.profit_change_LRD.level, "good");
  assert.equal(res.body.summary, null, "no AI without a key");
});

test("a new farmer gets a starting tip", async () => {
  const me = await farmer("0775553004");
  const res = await api(server.baseUrl, "/api/insights", { token: me.token });
  assert.equal(res.body.insights[0].key, "start");
});

test("AI summary uses only facts, never the farmer's name or phone, and falls back on error", async () => {
  const me = await farmer("0775553005");
  await expense(me.id, "seeds", 800, daysAgo(10));
  let sent = null;
  process.env.ANTHROPIC_API_KEY = "test-key";
  setInsightsFetcher(async (url, options) => {
    sent = JSON.parse(options.body);
    assert.equal(options.headers["x-api-key"], "test-key");
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "This season you spent L$800 on seed. Try to sell some harvest soon." }] }) };
  });
  const res = await api(server.baseUrl, "/api/insights", { token: me.token });
  assert.deepEqual(res.body.summary, { text: "This season you spent L$800 on seed. Try to sell some harvest soon.", by: "ai" });
  const text = JSON.stringify(sent);
  assert.equal(text.includes("Musu"), false);
  assert.equal(text.includes("775553005"), false);
  assert.match(sent.system, /ONLY the numbers/);

  setInsightsFetcher(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  await expense(me.id, "seeds", 100, daysAgo(5)); // new facts, so no cache
  const fallback = await api(server.baseUrl, "/api/insights", { token: me.token });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.summary, null);
  assert.ok(fallback.body.insights.length > 0);
  delete process.env.ANTHROPIC_API_KEY;
});

test("only farmers can ask", async () => {
  assert.equal((await api(server.baseUrl, "/api/insights")).status, 401);
});

test("rules never mix currencies", () => {
  const facts = {
    county: "Bong",
    money: { now: { in: { LRD: 0, USD: 100 }, costs: { LRD: 500, USD: 0 }, profit: { LRD: -500, USD: 100 } }, before: { in: { LRD: 0, USD: 0 }, costs: { LRD: 0, USD: 0 }, profit: { LRD: 0, USD: 0 } } },
    costs: [], harvest: [], prices: [], work: { now: 0, before: 0, lastRecord: null }
  };
  const keys = ruleInsights(facts).map((item) => item.text);
  assert.ok(keys.some((text) => /spent L\$500 more than came in/.test(text)));
  assert.ok(keys.some((text) => /profit of US\$100/.test(text)));
});
