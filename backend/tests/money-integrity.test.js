import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, resetDatabase, startServer } from "./helpers.js";
// The phone's own money maths, checked against the server's report.
import { batchMoney, farmMoney, moneySummary } from "../../frontend/src/lib/ledger.js";

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
    fullName: "Money Farmer",
    phoneNumber: `07755${String(phone).padStart(5, "0")}`,
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    pin: "1122",
    confirmPin: "1122"
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.token;
}

async function newFarm(token, crops = ["Rice", "Cassava"]) {
  const result = await post("/api/farms", token, {
    clientId: uid(),
    farmName: "Farm",
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    farmType: "crop_farming",
    crops
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.farm;
}

async function newHarvest(token, farm, overrides = {}) {
  const result = await post("/api/harvests", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    crop: "Rice",
    harvestDate: "2026-10-01",
    quantity: 10,
    unit: "bags",
    ...overrides
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.record;
}

function saleBody(harvest, overrides = {}) {
  return {
    clientId: uid(),
    harvestClientId: harvest.clientId,
    saleDate: "2026-10-05",
    quantity: 1,
    unitPrice: 1000,
    currency: "LRD",
    ...overrides
  };
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

test("farms keep a list of crops; a harvest must be one of them", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token, ["rice", " Cassava ", "RICE"]);
  assert.deepEqual(farm.crops, ["Rice", "Cassava"]);
  assert.equal(farm.mainCropOrLivestock, "Rice, Cassava");

  // Old phones still send one text.
  const old = await post("/api/farms", token, {
    clientId: uid(),
    farmName: "Old farm",
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    farmType: "mixed_farming",
    mainCropOrLivestock: "Pepper, Corn and goats"
  });
  assert.deepEqual(old.body.farm.crops, ["Pepper", "Corn", "Goats"]);

  const wrong = await post("/api/harvests", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    crop: "Pepper",
    harvestDate: "2026-10-01",
    quantity: 3,
    unit: "bags"
  });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error.message, /not on the farm/);

  const right = await newHarvest(token, farm, { crop: "cassava" });
  assert.equal(right.crop, "cassava");

  // Moving it to a farm that doesn't grow it is refused too.
  const other = await newFarm(token, ["Pepper"]);
  const moved = await patch(`/api/harvests/${right.id}`, token, { farmClientId: other.clientId });
  assert.equal(moved.status, 400);
});

test("a sale from a harvest takes its crop and unit, and can't sell more than the batch", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const harvest = await newHarvest(token, farm, { quantity: 10, unit: "bags" });

  const sale = await post("/api/sales", token, saleBody(harvest, { quantity: 4, crop: "Gold", unit: "tons" }));
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  assert.equal(sale.body.record.crop, "Rice");
  assert.equal(sale.body.record.unit, "bags");

  const tooMuch = await post("/api/sales", token, saleBody(harvest, { quantity: 6.5 }));
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.body.error.code, "OVERSOLD");
  assert.equal(tooMuch.body.error.details.left, 6);

  const exact = await post("/api/sales", token, saleBody(harvest, { quantity: 6 }));
  assert.equal(exact.status, 201);

  // Editing a sale up past what is left is refused; down is fine.
  const up = await patch(`/api/sales/${sale.body.record.id}`, token, { quantity: 5 });
  assert.equal(up.status, 409);
  const down = await patch(`/api/sales/${sale.body.record.id}`, token, { quantity: 3 });
  assert.equal(down.status, 200);
  assert.equal(down.body.record.totalAmount, 3000);

  // A replay of a saved sale is not checked again (it was fine the first time).
  const replay = await post("/api/sales", token, { ...saleBody(harvest), clientId: exact.body.record.clientId, quantity: 6 });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.created, false);

  // A sale without a harvest still needs a crop and a unit.
  const loose = await post("/api/sales", token, {
    clientId: uid(),
    saleDate: "2026-10-05",
    quantity: 2,
    totalAmount: 500,
    currency: "LRD"
  });
  assert.equal(loose.status, 400);
});

test("payments can't add up to more than the sale, and a sale can't drop below what was paid", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const harvest = await newHarvest(token, farm);
  const sale = (await post("/api/sales", token, saleBody(harvest, { quantity: 2, unitPrice: 2500 }))).body.record;
  assert.equal(sale.totalAmount, 5000);

  const pay = (amount) =>
    post("/api/payments", token, { clientId: uid(), saleClientId: sale.clientId, amount, paidDate: "2026-10-06" });

  assert.equal((await pay(3000)).status, 201);
  const over = await pay(2000.01);
  assert.equal(over.status, 409);
  assert.equal(over.body.error.code, "OVERPAID");
  assert.equal(over.body.error.details.owed, 2000);
  const last = await pay(2000);
  assert.equal(last.status, 201);
  assert.equal((await pay(1)).status, 409);

  // Editing a payment up is checked against the others.
  const edit = await patch(`/api/payments/${last.body.record.id}`, token, { amount: 2500 });
  assert.equal(edit.status, 409);

  const lower = await patch(`/api/sales/${sale.id}`, token, { unitPrice: 2000 });
  assert.equal(lower.status, 409);
  assert.equal(lower.body.error.code, "BELOW_PAID");
  const currency = await patch(`/api/sales/${sale.id}`, token, { currency: "USD" });
  assert.equal(currency.status, 409);

  // Deleting one payment frees that amount again.
  assert.equal((await del(`/api/payments/${last.body.record.id}`, token)).status, 200);
  assert.equal((await pay(2000)).status, 201);
});

test("two phones selling from the same batch at the same moment can't over-sell it", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const harvest = await newHarvest(token, farm, { quantity: 10 });

  const attempts = await Promise.all(
    Array.from({ length: 12 }, () => post("/api/sales", token, saleBody(harvest, { quantity: 3 })))
  );
  const ok = attempts.filter((result) => result.status === 201);
  const refused = attempts.filter((result) => result.status === 409);
  assert.equal(ok.length, 3, "only three sales of 3 bags fit in 10 bags");
  assert.equal(refused.length, 9);
  assert.ok(refused.every((result) => result.body.error.code === "OVERSOLD"));

  const list = await api(server.baseUrl, `/api/sales?harvestClientId=${harvest.clientId}`, { token });
  const sold = list.body.items.reduce((sum, item) => sum + item.quantity, 0);
  assert.equal(sold, 9);
});

test("many payments at the same moment can't over-pay a sale", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const harvest = await newHarvest(token, farm);
  const sale = (await post("/api/sales", token, saleBody(harvest, { quantity: 1, unitPrice: 1000 }))).body.record;

  const attempts = await Promise.all(
    Array.from({ length: 15 }, () =>
      post("/api/payments", token, { clientId: uid(), saleClientId: sale.clientId, amount: 300, paidDate: "2026-10-06" })
    )
  );
  assert.equal(attempts.filter((result) => result.status === 201).length, 3);
  assert.ok(attempts.filter((result) => result.status !== 201).every((result) => result.body.error.code === "OVERPAID"));

  // The same payment sent twice at once (a retry) is saved once.
  const clientId = uid();
  const twice = await Promise.all([
    post("/api/payments", token, { clientId, saleClientId: sale.clientId, amount: 100, paidDate: "2026-10-06" }),
    post("/api/payments", token, { clientId, saleClientId: sale.clientId, amount: 100, paidDate: "2026-10-06" })
  ]);
  assert.deepEqual(twice.map((result) => result.status).sort(), [200, 201]);
  const payments = await api(server.baseUrl, `/api/payments?saleClientId=${sale.clientId}`, { token });
  assert.equal(payments.body.items.reduce((sum, item) => sum + item.amount, 0), 1000);
});

test("harvest quantity and delete stay consistent with its sales and checks", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const harvest = await newHarvest(token, farm, { quantity: 10 });
  const check = await post("/api/inspections", token, {
    clientId: uid(),
    harvestClientId: harvest.clientId,
    inspectionDate: "2026-10-02",
    grade: "A"
  });
  assert.equal(check.status, 201);
  const sale = (await post("/api/sales", token, saleBody(harvest, { quantity: 6 }))).body.record;

  const below = await patch(`/api/harvests/${harvest.id}`, token, { quantity: 5 });
  assert.equal(below.status, 409);
  assert.equal(below.body.error.code, "BELOW_SOLD");
  assert.equal((await patch(`/api/harvests/${harvest.id}`, token, { quantity: 6 })).status, 200);
  const unit = await patch(`/api/harvests/${harvest.id}`, token, { unit: "kg" });
  assert.equal(unit.status, 409);

  const blocked = await del(`/api/harvests/${harvest.id}`, token);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, "HARVEST_HAS_SALES");

  // Deleting the sale takes its payments with it; then the harvest can go,
  // and its quality checks go with it.
  await post("/api/payments", token, { clientId: uid(), saleClientId: sale.clientId, amount: 100, paidDate: "2026-10-06" });
  assert.equal((await del(`/api/sales/${sale.id}`, token)).status, 200);
  const payments = await api(server.baseUrl, `/api/payments?saleClientId=${sale.clientId}`, { token });
  assert.equal(payments.body.items.length, 0);

  assert.equal((await del(`/api/harvests/${harvest.id}`, token)).status, 200);
  const checks = await api(server.baseUrl, `/api/inspections?harvestClientId=${harvest.clientId}`, { token });
  assert.equal(checks.body.items.length, 0);
});

test("the passport counts sold quantity in the batch's own unit", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const harvest = await newHarvest(token, farm, { quantity: 10 });
  await post("/api/sales", token, saleBody(harvest, { quantity: 4 }));
  await patch(`/api/harvests/${harvest.id}`, token, { passportPublic: true });
  const passport = await api(server.baseUrl, `/api/passport/${harvest.passportCode}`);
  assert.equal(passport.status, 200);
  assert.equal(passport.body.passport.quantitySold, 4);
  assert.equal(passport.body.passport.quantityLeft, 6);
});

// Builds a messy but realistic year of records, then checks the phone's
// maths (ledger.js) gives exactly the server's numbers, for several periods.
test("phone and server money totals agree (sales, income, expenses, profit, per farm, per batch)", async () => {
  const token = await newFarmer();
  const farms = [await newFarm(token, ["Rice"]), await newFarm(token, ["Cassava"])];
  let state = 7;
  const rand = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const day = (month, dayOfMonth) => `2026-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

  for (let i = 0; i < 6; i += 1) {
    const farm = farms[i % 2];
    const harvest = await newHarvest(token, farm, {
      crop: farm.crops[0],
      quantity: 20,
      harvestDate: day(1 + i, 3)
    });
    for (let j = 0; j < 3; j += 1) {
      const usd = rand() < 0.3;
      const sale = await post(
        "/api/sales",
        token,
        saleBody(harvest, {
          quantity: 1 + Math.floor(rand() * 5),
          unitPrice: usd ? Math.round(rand() * 2000) / 100 + 1 : 500 + Math.floor(rand() * 3000),
          currency: usd ? "USD" : "LRD",
          saleDate: day(1 + i + j, 10 + j)
        })
      );
      assert.equal(sale.status, 201, JSON.stringify(sale.body));
      const total = sale.body.record.totalAmount;
      const share = rand() < 0.5 ? 1 : 0.37;
      if (rand() < 0.8) {
        const payment = await post("/api/payments", token, {
          clientId: uid(),
          saleClientId: sale.body.record.clientId,
          amount: Math.round(total * share * 100) / 100,
          paidDate: day(Math.min(12, 2 + i + j), 20)
        });
        assert.equal(payment.status, 201, JSON.stringify(payment.body));
      }
    }
  }
  // A sale not from a harvest, and costs with and without a farm.
  await post("/api/sales", token, {
    clientId: uid(),
    saleDate: day(4, 4),
    crop: "Pepper",
    quantity: 3,
    unit: "buckets",
    totalAmount: 1234.5,
    currency: "LRD"
  });
  const allHarvests = (await api(server.baseUrl, "/api/harvests?pageSize=100", { token })).body.items;
  for (let k = 0; k < 6; k += 1) {
    const harvest = allHarvests[k % allHarvests.length];
    const cost = await post("/api/expenses", token, {
      clientId: uid(),
      harvestClientId: harvest.clientId,
      expenseDate: day(2 + k, 8),
      category: "labour",
      amount: 250 + k * 10,
      currency: k % 3 === 0 ? "USD" : "LRD"
    });
    assert.equal(cost.status, 201, JSON.stringify(cost.body));
    assert.equal(cost.body.record.farmClientId, harvest.farmClientId, "a batch cost lands on the batch's farm");
  }
  for (let k = 0; k < 10; k += 1) {
    const usd = rand() < 0.25;
    await post("/api/expenses", token, {
      clientId: uid(),
      farmClientId: rand() < 0.7 ? farms[k % 2].clientId : null,
      expenseDate: day(1 + (k % 12), 15),
      category: ["seeds", "labour", "fertilizer", "transport"][k % 4],
      amount: usd ? Math.round(rand() * 5000) / 100 + 1 : 100 + Math.floor(rand() * 4000),
      currency: usd ? "USD" : "LRD"
    });
  }

  const records = {};
  for (const kind of ["harvests", "sales", "payments", "expenses"]) {
    records[kind] = (await api(server.baseUrl, `/api/${kind}?pageSize=100`, { token })).body.items;
  }

  const sortRows = (rows, keys) =>
    [...rows].sort((a, b) => keys.map((key) => String(a[key]).localeCompare(String(b[key]))).find((v) => v) || 0);

  for (const period of [{}, { from: "2026-03-01", to: "2026-06-30" }, { from: "2026-07-01" }, { to: "2026-02-28" }]) {
    const query = new URLSearchParams(period).toString();
    const server_ = (await api(server.baseUrl, `/api/reports/summary${query ? `?${query}` : ""}`, { token })).body;
    const phone_ = moneySummary(records, period);
    for (const field of ["sold", "income", "received", "spent", "profit", "owed"]) {
      assert.deepEqual(phone_[field], server_.money[field], `${field} for ${JSON.stringify(period)}`);
    }
    assert.deepEqual(phone_.counts, server_.counts, `counts for ${JSON.stringify(period)}`);
    assert.deepEqual(
      sortRows(phone_.spentByCategory, ["category", "currency"]),
      sortRows(server_.spentByCategory, ["category", "currency"])
    );
    assert.deepEqual(
      sortRows(farmMoney(records, period), ["farmClientId", "currency"]),
      sortRows(server_.byFarm, ["farmClientId", "currency"]),
      `per farm for ${JSON.stringify(period)}`
    );
    assert.deepEqual(
      sortRows(batchMoney(records, period), ["harvestClientId", "currency"]),
      sortRows(server_.byBatch, ["harvestClientId", "currency"]),
      `per batch for ${JSON.stringify(period)}`
    );
  }
});

test("a cost can be for one harvest batch; deleting the batch keeps the cost on the farm", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token);
  const other = await newFarm(token, ["Pepper"]);
  const harvest = await newHarvest(token, farm);

  const wrongFarm = await post("/api/expenses", token, {
    clientId: uid(),
    farmClientId: other.clientId,
    harvestClientId: harvest.clientId,
    expenseDate: "2026-10-02",
    category: "labour",
    amount: 500,
    currency: "LRD"
  });
  assert.equal(wrongFarm.status, 400);

  const cost = await post("/api/expenses", token, {
    clientId: uid(),
    harvestClientId: harvest.clientId,
    expenseDate: "2026-10-02",
    category: "labour",
    amount: 500,
    currency: "LRD"
  });
  assert.equal(cost.status, 201);
  const sale = (await post("/api/sales", token, saleBody(harvest, { quantity: 2, unitPrice: 1000 }))).body.record;
  await post("/api/payments", token, { clientId: uid(), saleClientId: sale.clientId, amount: 1500, paidDate: "2026-10-06" });

  const summary = (await api(server.baseUrl, "/api/reports/summary", { token })).body;
  const batch = summary.byBatch.find((row) => row.harvestClientId === harvest.clientId && row.currency === "LRD");
  assert.deepEqual(
    { sold: batch.sold, income: batch.income, spent: batch.spent, profit: batch.profit },
    { sold: 2000, income: 1500, spent: 500, profit: 1000 }
  );
  const farmRow = summary.byFarm.find((row) => row.farmClientId === farm.clientId && row.currency === "LRD");
  assert.equal(farmRow.spent, 500);

  await del(`/api/sales/${sale.id}`, token);
  assert.equal((await del(`/api/harvests/${harvest.id}`, token)).status, 200);
  const kept = (await api(server.baseUrl, `/api/expenses?farmClientId=${farm.clientId}`, { token })).body.items;
  assert.equal(kept.length, 1);
  assert.equal(kept[0].harvestClientId, null);
  assert.equal(kept[0].amount, 500);
});

test("animal farms can record breeding, health checks and production", async () => {
  const token = await newFarmer();
  const farm = await newFarm(token, ["Goats"]);
  for (const activityType of ["breeding", "health_check", "production"]) {
    const result = await post("/api/activities", token, {
      clientId: uid(),
      farmId: farm.id,
      activityType,
      activityDate: "2026-10-01"
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
  }
});
