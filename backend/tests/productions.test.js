import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, resetDatabase, startServer } from "./helpers.js";
import { productionMoney } from "../../frontend/src/lib/ledger.js";
import { animalCount } from "../../frontend/src/lib/production.js";

// The Farm Production Record Management Guide: one farmer → many farms →
// each farm's crop plantings and animal groups → every record linked.

let server;
let seq = 0;
const uid = () => `client-${Date.now().toString(16)}-${(seq += 1)}-${Math.random().toString(16).slice(2, 8)}`;
const post = (path, token, body) => api(server.baseUrl, path, { method: "POST", token, body });
const patch = (path, token, body) => api(server.baseUrl, path, { method: "PATCH", token, body });
const del = (path, token) => api(server.baseUrl, path, { method: "DELETE", token });

let phone = 0;
async function newFarmer() {
  phone += 1;
  const result = await post("/api/auth/register", null, {
    fullName: "Guide Farmer",
    phoneNumber: `07766${String(phone).padStart(5, "0")}`,
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    pin: "1122",
    confirmPin: "1122"
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.token;
}

async function newFarm(token, farmType, crops) {
  const result = await post("/api/farms", token, {
    clientId: uid(),
    farmName: `${farmType} farm`,
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    farmType,
    crops
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.farm;
}

async function newProduction(token, farm, body) {
  const result = await post("/api/productions", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    startDate: "2026-03-01",
    ...body
  });
  return result;
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

test("a crop farm keeps separate plantings for each crop; harvests, work and costs link to them", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token, "crop_farming", ["Cassava"]);
  const cassava = await newProduction(token, farm, {
    productionKind: "crop",
    name: "Cassava",
    variety: "TMS",
    plot: "Upland",
    area: 2,
    areaUnit: "acres",
    source: "own",
    method: "cuttings"
  });
  assert.equal(cassava.status, 201, JSON.stringify(cassava.body));
  // Rice is not on the farm list yet; starting a rice planting adds it.
  const rice = await newProduction(token, farm, { productionKind: "crop", name: "Rice", method: "seeds", source: "bought" });
  assert.equal(rice.status, 201);
  const farmAfter = await api(server.baseUrl, `/api/farms/${farm.id}`, { token });
  assert.deepEqual(farmAfter.body.farm.crops, ["Cassava", "Rice"]);

  // A crop farm can't keep animals until it is made mixed.
  const goats = await newProduction(token, farm, { productionKind: "animal", name: "Goats", startCount: 4 });
  assert.equal(goats.status, 400);
  assert.match(goats.body.error.message, /mixed farm/);

  // Work for one planting.
  const work = await post("/api/activities", token, {
    clientId: uid(),
    farmId: farm.id,
    activityType: "monitoring",
    activityDate: "2026-04-01",
    productionClientId: cassava.body.record.clientId
  });
  assert.equal(work.status, 201, JSON.stringify(work.body));
  assert.equal(work.body.activity.productionClientId, cassava.body.record.clientId);

  // A harvest from the rice planting must be rice.
  const wrong = await post("/api/harvests", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    productionClientId: rice.body.record.clientId,
    crop: "Cassava",
    harvestDate: "2026-07-01",
    quantity: 5,
    unit: "bags"
  });
  assert.equal(wrong.status, 400);
  const harvest = await post("/api/harvests", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    productionClientId: rice.body.record.clientId,
    crop: "Rice",
    harvestDate: "2026-07-01",
    quantity: 20,
    unit: "bags"
  });
  assert.equal(harvest.status, 201);

  // A sale and a cost made from the batch count for the rice planting.
  const sale = await post("/api/sales", token, {
    clientId: uid(),
    harvestClientId: harvest.body.record.clientId,
    saleDate: "2026-07-05",
    quantity: 10,
    unitPrice: 3000,
    currency: "LRD"
  });
  assert.equal(sale.body.record.productionClientId, rice.body.record.clientId);
  await post("/api/payments", token, { clientId: uid(), saleClientId: sale.body.record.clientId, amount: 25000, paidDate: "2026-07-06" });
  const seed = await post("/api/expenses", token, {
    clientId: uid(),
    productionClientId: rice.body.record.clientId,
    expenseDate: "2026-03-01",
    category: "seeds",
    amount: 4000,
    currency: "LRD"
  });
  assert.equal(seed.status, 201);
  assert.equal(seed.body.record.farmClientId, farm.clientId, "a planting's cost lands on its farm");

  const summary = (await api(server.baseUrl, "/api/reports/summary", { token })).body;
  const riceMoney = summary.byProduction.find((row) => row.productionClientId === rice.body.record.clientId);
  assert.deepEqual(
    { sold: riceMoney.sold, income: riceMoney.income, spent: riceMoney.spent, profit: riceMoney.profit },
    { sold: 30000, income: 25000, spent: 4000, profit: 21000 }
  );

  // The phone works out the same.
  const records = {};
  for (const kind of ["harvests", "sales", "payments", "expenses"]) {
    records[kind] = (await api(server.baseUrl, `/api/${kind}?pageSize=100`, { token })).body.items;
  }
  assert.deepEqual(productionMoney(records), summary.byProduction);

  // A planting with harvests can't be deleted, only finished.
  const blocked = await del(`/api/productions/${rice.body.record.id}`, token);
  assert.equal(blocked.status, 409);
  const finished = await patch(`/api/productions/${rice.body.record.id}`, token, { status: "finished", endDate: "2026-07-30" });
  assert.equal(finished.body.record.status, "finished");
  // An empty planting can go; its work just loses the link.
  assert.equal((await del(`/api/productions/${cassava.body.record.id}`, token)).status, 200);
  const works = (await api(server.baseUrl, "/api/activities", { token })).body.items;
  assert.equal(works[0].productionClientId, null);
});

test("an animal group's count follows births, buying, deaths and sales, and never goes below zero", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token, "poultry", ["Chicken"]);
  const birds = await newProduction(token, farm, { productionKind: "animal", name: "Chicken", label: "Layers 1", startCount: 50, source: "bought", ageGroup: "young" });
  assert.equal(birds.status, 201, JSON.stringify(birds.body));
  const group = birds.body.record;
  const event = (eventType, quantity, extra = {}) =>
    post("/api/animalEvents", token, {
      clientId: uid(),
      productionClientId: group.clientId,
      eventType,
      quantity,
      eventDate: "2026-04-01",
      ...extra
    });

  assert.equal((await event("born", 10)).status, 201);
  const died = await event("died", 3, { cause: "sickness" });
  assert.equal(died.body.record.cause, "sickness");
  const unknown = await event("died", 2);
  assert.equal(unknown.body.record.cause, "unknown", "a death without a cause is 'unknown'");
  assert.equal((await event("sold", 20)).status, 201);
  // 50 + 10 − 3 − 2 − 20 = 35
  const tooMany = await event("eaten", 36);
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.body.error.code, "NOT_ENOUGH_ANIMALS");
  assert.equal(tooMany.body.error.details.count, 35);

  // Taking back the 10 births would leave 25: fine. Taking back the start
  // to 5 would leave a negative count: refused.
  const tooSmallStart = await patch(`/api/productions/${group.id}`, token, { startCount: 5 });
  assert.equal(tooSmallStart.status, 409);

  const events = (await api(server.baseUrl, `/api/animalEvents?productionClientId=${group.clientId}`, { token })).body.items;
  assert.equal(animalCount(group, events), 35, "the phone counts the same");

  // Eggs come from the group as a harvest of eggs.
  const eggs = await post("/api/harvests", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    productionClientId: group.clientId,
    crop: "Eggs",
    harvestDate: "2026-04-02",
    quantity: 300,
    unit: "eggs"
  });
  assert.equal(eggs.status, 201, JSON.stringify(eggs.body));
  const notEggs = await post("/api/harvests", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    productionClientId: group.clientId,
    crop: "Rice",
    harvestDate: "2026-04-02",
    quantity: 3,
    unit: "bags"
  });
  assert.equal(notEggs.status, 400);

  // Births and buying are only for animal groups.
  const cropFarm = await newFarm(token, "mixed_farming", ["Corn"]);
  const corn = (await newProduction(token, cropFarm, { productionKind: "crop", name: "Corn" })).body.record;
  const wrongKind = await post("/api/animalEvents", token, {
    clientId: uid(),
    productionClientId: corn.clientId,
    eventType: "born",
    quantity: 1,
    eventDate: "2026-04-01"
  });
  assert.equal(wrongKind.status, 400);
});

test("two phones taking animals out of a group at once can't take more than are there", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token, "livestock", ["Goats"]);
  const group = (await newProduction(token, farm, { productionKind: "animal", name: "Goats", startCount: 10 })).body.record;
  const attempts = await Promise.all(
    Array.from({ length: 8 }, () =>
      post("/api/animalEvents", token, {
        clientId: uid(),
        productionClientId: group.clientId,
        eventType: "sold",
        quantity: 3,
        eventDate: "2026-05-01"
      })
    )
  );
  assert.equal(attempts.filter((result) => result.status === 201).length, 3);
  const events = (await api(server.baseUrl, `/api/animalEvents?productionClientId=${group.clientId}`, { token })).body.items;
  assert.equal(animalCount(group, events), 1);
});

test("mixed farms trace manure and leftovers; a farm can change type without losing records", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token, "crop_farming", ["Cassava"]);
  const cassava = (await newProduction(token, farm, { productionKind: "crop", name: "Cassava" })).body.record;

  // The crop farm starts keeping chickens: it becomes mixed; the change is kept.
  const changed = await patch(`/api/farms/${farm.id}`, token, { farmType: "mixed_farming" });
  assert.equal(changed.status, 200);
  const chickens = await newProduction(token, farm, { productionKind: "animal", name: "Chicken", startCount: 30 });
  assert.equal(chickens.status, 201, JSON.stringify(chickens.body));

  const manure = await post("/api/activities", token, {
    clientId: uid(),
    farmId: farm.id,
    activityType: "fertilizer_application",
    activityDate: "2026-05-01",
    inputUsed: "Chicken dung",
    productionClientId: cassava.clientId,
    sourceProductionClientId: chickens.body.record.clientId
  });
  assert.equal(manure.status, 201, JSON.stringify(manure.body));
  assert.equal(manure.body.activity.sourceProductionClientId, chickens.body.record.clientId);

  const detail = await api(server.baseUrl, `/api/farms/${farm.id}`, { token });
  assert.deepEqual(
    detail.body.farm.typeChanges.map((change) => [change.fromType, change.toType]),
    [["crop_farming", "mixed_farming"]]
  );
  // Old records are untouched.
  const plantings = (await api(server.baseUrl, `/api/productions?farmClientId=${farm.clientId}`, { token })).body.items;
  assert.equal(plantings.length, 2);

  // Work on another farm can't name this farm's planting.
  const other = await newFarm(token, "crop_farming", ["Rice"]);
  const wrongFarm = await post("/api/activities", token, {
    clientId: uid(),
    farmId: other.id,
    activityType: "weeding",
    activityDate: "2026-05-02",
    productionClientId: cassava.clientId
  });
  assert.equal(wrongFarm.status, 400);
});

test("records of one farmer can't point at another farmer's planting", async () => {
  const one = await newFarmer();
  const two = await newFarmer();
  const farm = await newFarm(one, "crop_farming", ["Rice"]);
  const rice = (await newProduction(one, farm, { productionKind: "crop", name: "Rice" })).body.record;
  const twoFarm = await newFarm(two, "crop_farming", ["Rice"]);
  const steal = await post("/api/harvests", two, {
    clientId: uid(),
    farmClientId: twoFarm.clientId,
    productionClientId: rice.clientId,
    crop: "Rice",
    harvestDate: "2026-06-01",
    quantity: 1,
    unit: "bags"
  });
  assert.equal(steal.status, 409, "unknown to this farmer");
  const list = (await api(server.baseUrl, "/api/productions", { token: two })).body.items;
  assert.equal(list.length, 0);
});
