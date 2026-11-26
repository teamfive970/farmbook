import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, query, resetDatabase, startServer } from "./helpers.js";
import { setSmsTransportForTests } from "../src/lib/sms.js";
import { runPriceSms } from "../src/services/priceSmsService.js";

let server;
const sent = [];

before(async () => {
  process.env.MARKET_MIN_FARMERS = "1";
  process.env.MARKET_MIN_SALES = "1";
  process.env.USSD_SECRET = "price-key";
  setSmsTransportForTests(async (phone, message) => sent.push({ phone, message }));
  server = await startServer();
});
beforeEach(async () => {
  sent.length = 0;
  await resetDatabase();
});
after(async () => {
  setSmsTransportForTests(null);
  delete process.env.MARKET_MIN_FARMERS;
  delete process.env.MARKET_MIN_SALES;
  delete process.env.USSD_SECRET;
  await server.close();
  await closeDatabase();
});

async function farmer(phoneNumber, county = "Bong") {
  const res = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Musu Kollie", phoneNumber, county, district: "D", community: "C", pin: "1122", confirmPin: "1122" }
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

// Market prices need at least two different farmers.
let seedNo = 0;
async function seedSale(county) {
  for (let i = 0; i < 2; i += 1) {
    seedNo += 1;
    await farmer(`07755529${String(seedNo).padStart(2, "0")}`, county);
    const { rows } = await query("SELECT id FROM farmers ORDER BY created_at DESC LIMIT 1");
    await query(
      `INSERT INTO sales (farmer_id, client_id, crop, quantity, unit, unit_price, total_amount, currency, sale_date)
       VALUES ($1, 'sale-price-seed-01', 'Rice', 10, 'bags', 3200, 32000, 'LRD', CURRENT_DATE)`,
      [rows[0].id]
    );
  }
}

test("price SMS is off by default and can be switched on in the app", async () => {
  const { token } = await farmer("0775552001");
  const inbox = await api(server.baseUrl, "/api/notifications", { token });
  assert.equal(inbox.body.settings.priceSms, false);
  const on = await api(server.baseUrl, "/api/notifications/settings", { method: "PATCH", token, body: { priceSms: true } });
  assert.deepEqual(on.body.settings, { sms: true, priceSms: true });
  const bad = await api(server.baseUrl, "/api/notifications/settings", { method: "PATCH", token, body: { priceSms: "yes" } });
  assert.equal(bad.status, 400);
  const none = await api(server.baseUrl, "/api/notifications/settings", { method: "PATCH", token, body: {} });
  assert.equal(none.status, 400);
});

test("weekly prices go once a week, by day only, with an inbox copy", async () => {
  const { token } = await farmer("0775552002", "Bong");
  await farmer("0775552003", "Bong"); // not switched on
  await api(server.baseUrl, "/api/notifications/settings", { method: "PATCH", token, body: { priceSms: true } });

  const noon = new Date("2026-11-30T12:00:00Z");
  // No prices yet: nothing is sent.
  assert.deepEqual(await runPriceSms({ now: noon }), { sent: 0, inbox: 0, farmers: 1 });
  await seedSale("Bong");

  assert.equal((await runPriceSms({ now: new Date("2026-11-30T22:00:00Z") })).skipped, "night");
  const first = await runPriceSms({ now: noon });
  assert.deepEqual(first, { sent: 1, inbox: 1, farmers: 1 });
  assert.match(sent[0].message, /^FarmBok prices, Bong County \(last \d+ days\): Rice L\$3,200\/bag/);
  assert.equal(sent[0].phone, "+231775552002");

  assert.equal((await runPriceSms({ now: new Date("2026-12-03T12:00:00Z") })).farmers, 0, "not again the same week");
  const next = await runPriceSms({ now: new Date("2026-12-07T10:00:00Z") });
  assert.equal(next.sent, 1);

  const { rows } = await query("SELECT count(*)::int AS n FROM notifications WHERE topic = 'prices'");
  assert.equal(rows[0].n, 2);
});

test("a county with no sales gets prices for all of Liberia", async () => {
  const { token } = await farmer("0775552004", "Sinoe");
  await api(server.baseUrl, "/api/notifications/settings", { method: "PATCH", token, body: { priceSms: true } });
  await seedSale("Bong");
  await runPriceSms({ now: new Date("2026-11-30T12:00:00Z") });
  assert.match(sent[0].message, /^FarmBok prices, Liberia/);
});

test("USSD can switch the price SMS on and off (Notifications, then 2)", async () => {
  await farmer("0775552005");
  let count = 0;
  // Each switch is its own USSD session, like dialling again.
  const session = () => {
    const sessionId = `p${++count}`;
    return async (text) =>
      (
        await fetch(`${server.baseUrl}/api/ussd?key=price-key`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ sessionId, phoneNumber: "+231775552005", text })
        })
      ).text();
  };
  const first = session();
  assert.match(await first("1122*7*2"), /every week\?\n1\. Yes/);
  assert.match(await first("1122*7*2*1"), /now ON/);
  const second = session();
  assert.match(await second("1122*7*2"), /is ON/);
  assert.match(await second("1122*7*2*1"), /now OFF/);
});
