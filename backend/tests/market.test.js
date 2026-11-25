import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, query, resetDatabase, startServer } from "./helpers.js";

let server;
let seq = 0;
let phone = 0;
const uid = () => `client-${Date.now().toString(16)}-${(seq += 1)}-${Math.random().toString(16).slice(2, 8)}`;
const post = (path, token, body) => api(server.baseUrl, path, { method: "POST", token, body });
const get = (path) => api(server.baseUrl, path);
function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function farmer(county = "Bong", name = "Musu Kollie") {
  phone += 1;
  const number = `07744${String(phone).padStart(5, "0")}`;
  const reg = await post("/api/auth/register", null, {
    fullName: name,
    phoneNumber: number,
    county,
    district: "Town",
    community: "Village",
    pin: "1122",
    confirmPin: "1122"
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const token = reg.body.token;
  const farm = (
    await post("/api/farms", token, {
      clientId: uid(),
      farmName: "Farm",
      county,
      district: "Town",
      community: "Village",
      farmType: "crop_farming",
      crops: ["Rice", "Cassava"]
    })
  ).body.farm;
  return { token, id: reg.body.user.id, number, farm };
}

async function harvest(owner, { crop = "Rice", quantity = 20, unit = "bags", days = 5, passport = true, grade = null } = {}) {
  const record = (
    await post("/api/harvests", owner.token, {
      clientId: uid(),
      farmClientId: owner.farm.clientId,
      crop,
      harvestDate: daysAgo(days),
      quantity,
      unit
    })
  ).body.record;
  if (grade) {
    await post("/api/inspections", owner.token, { clientId: uid(), harvestClientId: record.clientId, inspectionDate: daysAgo(days), grade });
  }
  if (passport) {
    const on = await api(server.baseUrl, `/api/harvests/${record.id}`, { method: "PATCH", token: owner.token, body: { passportPublic: true } });
    assert.equal(on.status, 200, JSON.stringify(on.body));
  }
  return record;
}

async function sell(owner, record, { quantity = 2, unitPrice = 2500, currency = "LRD", days = 3 } = {}) {
  const sale = await post("/api/sales", owner.token, {
    clientId: uid(),
    harvestClientId: record.clientId,
    saleDate: daysAgo(days),
    quantity,
    unitPrice,
    currency
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  return sale.body.record;
}

before(async () => {
  server = await startServer();
});
beforeEach(async () => {
  await resetDatabase();
});
after(async () => {
  await server.close();
  await closeDatabase();
});

test("harvests for sale: only passports the farmer turned on, with some left, first name only", async () => {
  const musu = await farmer("Bong", "Musu Kollie");
  const kebbeh = await farmer("Nimba", "Kebbeh Toe");
  const away = await farmer("Bong", "Away Farmer");

  const rice = await harvest(musu, { crop: "Rice", quantity: 20, grade: "A" });
  await sell(musu, rice, { quantity: 5 });
  const soldOut = await harvest(musu, { crop: "Rice", quantity: 3 });
  await sell(musu, soldOut, { quantity: 3 });
  await harvest(musu, { crop: "Rice", passport: false });
  await harvest(musu, { crop: "Rice", days: 400 }); // too old to still be for sale
  await harvest(kebbeh, { crop: "cassava", quantity: 30, unit: "bundles", grade: "B" });
  await harvest(away);
  await query("UPDATE farmers SET status = 'inactive' WHERE id = $1", [away.id]);
  await harvest(kebbeh, { crop: "Rice", grade: "rejected" }); // failed its check: not on the market

  const all = await get("/api/market/harvests");
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 2);
  const [first, second] = all.body.harvests;
  assert.deepEqual(
    all.body.harvests.map((item) => [item.crop, item.quantityLeft, item.grade, item.place.county, item.farmer.firstName]).sort(),
    [
      ["Cassava", 30, "B", "Nimba", "Kebbeh"],
      ["Rice", 15, "A", "Bong", "Musu"]
    ]
  );
  assert.match(first.passportCode, /^LR-/);
  assert.ok(second.harvestDate);
  assert.deepEqual(all.body.filters, { crops: ["Cassava", "Rice"], counties: ["Bong", "Nimba"] });
  const text = JSON.stringify(all.body);
  for (const owner of [musu, kebbeh]) assert.equal(text.includes(owner.number.slice(1)), false);
  assert.equal(text.includes("Kollie"), false);

  assert.deepEqual((await get("/api/market/harvests?crop=RICE")).body.harvests.map((h) => h.crop), ["Rice"]);
  assert.deepEqual((await get("/api/market/harvests?county=nimba")).body.harvests.map((h) => h.crop), ["Cassava"]);
  assert.deepEqual((await get("/api/market/harvests?grade=a")).body.harvests.map((h) => h.grade), ["A"]);
  assert.equal((await get("/api/market/harvests?county=Atlantis")).status, 400);
});

test("prices show only when at least 3 farmers sold, never one farmer's own price", async () => {
  const farmers = [await farmer("Bong"), await farmer("Bong"), await farmer("Bong"), await farmer("Nimba")];
  const prices = [2000, 2400, 3000];
  for (const [index, owner] of farmers.slice(0, 2).entries()) {
    await sell(owner, await harvest(owner), { unitPrice: prices[index] });
  }
  // Two farmers only: nothing shown yet.
  assert.deepEqual((await get("/api/market/prices")).body.prices, []);

  await sell(farmers[2], await harvest(farmers[2]), { unitPrice: prices[2] });
  const shown = await get("/api/market/prices");
  assert.equal(shown.status, 200);
  assert.equal(shown.body.prices.length, 1);
  const rice = shown.body.prices[0];
  assert.deepEqual(
    { crop: rice.crop, unit: rice.unit, currency: rice.currency, median: rice.median, low: rice.low, high: rice.high, sales: rice.sales, farmers: rice.farmers },
    { crop: "Rice", unit: "bags", currency: "LRD", median: 2400, low: 2200, high: 2700, sales: 3, farmers: 3 }
  );
  assert.equal(rice.changePercent, null);
  assert.deepEqual(shown.body.rule, { minSales: 3, minFarmers: 3 });
  assert.equal(JSON.stringify(shown.body).includes(farmers[0].id), false);

  // One more sale in US dollars by a farmer in another county: kept apart, and
  // not enough on its own to be shown.
  await sell(farmers[3], await harvest(farmers[3]), { unitPrice: 15, currency: "USD" });
  assert.deepEqual((await get("/api/market/prices")).body.prices.map((p) => p.currency), ["LRD"]);
  assert.deepEqual((await get("/api/market/prices?county=Nimba")).body.prices, []);
  assert.deepEqual((await get("/api/market/prices")).body.counties, ["Bong", "Nimba"]);
});

test("price change against the 60 days before", async () => {
  const owners = [await farmer(), await farmer(), await farmer()];
  for (const owner of owners) {
    const record = await harvest(owner, { days: 100, quantity: 50 });
    await sell(owner, record, { unitPrice: 2000, days: 90 });
    await sell(owner, record, { unitPrice: 2500, days: 10 });
  }
  const rice = (await get("/api/market/prices")).body.prices[0];
  assert.equal(rice.median, 2500);
  assert.equal(rice.previousMedian, 2000);
  assert.equal(rice.changePercent, 25);
});
