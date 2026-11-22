import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, createAdminRecord, loginAs, query, resetDatabase, startServer } from "./helpers.js";

let server;

const uid = () => `client-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

async function registerFarmer(phoneNumber, fullName = "Esther Kollie") {
  const result = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      fullName,
      phoneNumber,
      county: "Bong",
      district: "Gbarnga",
      community: "Kpelleh Town",
      pin: "1122",
      confirmPin: "1122"
    }
  });
  assert.equal(result.status, 201);
  return result.body;
}

async function createFarm(token, overrides = {}) {
  const clientId = uid();
  const result = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token,
    body: {
      clientId,
      farmName: "Rice farm",
      county: "Bong",
      district: "Gbarnga",
      community: "Kpelleh Town",
      farmType: "crop_farming",
      mainCropOrLivestock: "Rice",
      ...overrides
    }
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.farm;
}

const post = (path, token, body) => api(server.baseUrl, path, { method: "POST", token, body });

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

test("farms keep an optional size with a unit", async () => {
  const { token } = await registerFarmer("0772220001");
  const farm = await createFarm(token, { size: 2.5, sizeUnit: "acres" });
  assert.equal(farm.size, 2.5);
  assert.equal(farm.sizeUnit, "acres");

  const noUnit = await post("/api/farms", token, {
    clientId: uid(),
    farmName: "No unit",
    county: "Bong",
    district: "Gbarnga",
    community: "Gbarnga",
    farmType: "crop_farming",
    size: 3
  });
  assert.equal(noUnit.status, 400);
  assert.equal(noUnit.body.error.details.field, "sizeUnit");

  const changed = await api(server.baseUrl, `/api/farms/${farm.id}`, {
    method: "PATCH",
    token,
    body: { size: 1, sizeUnit: "hectares" }
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.farm.size, 1);
  assert.equal(changed.body.farm.sizeUnit, "hectares");

  const badUnit = await api(server.baseUrl, `/api/farms/${farm.id}`, {
    method: "PATCH",
    token,
    body: { sizeUnit: "ropes" }
  });
  assert.equal(badUnit.status, 400);
});

test("harvest batches are idempotent and get a passport code", async () => {
  const { token } = await registerFarmer("0772220002");
  const farm = await createFarm(token);
  const body = {
    clientId: uid(),
    farmClientId: farm.clientId,
    crop: "Rice",
    harvestDate: "2026-11-15",
    quantity: 12,
    unit: "bags"
  };
  const first = await post("/api/harvests", token, body);
  assert.equal(first.status, 201);
  assert.match(first.body.record.passportCode, /^LR-[A-Z0-9]{10}$/);
  assert.equal(first.body.record.passportPublic, false);
  assert.equal(first.body.record.harvestDate, "2026-11-15");

  const retry = await post("/api/harvests", token, body);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.created, false);
  assert.equal(retry.body.record.id, first.body.record.id);

  const list = await api(server.baseUrl, `/api/harvests?farmClientId=${farm.clientId}`, { token });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].quantity, 12);
});

test("records made offline sync parent-first by client id", async () => {
  const { token } = await registerFarmer("0772220003");
  const farm = await createFarm(token);
  const harvestClientId = uid();

  // A check sent before its harvest is refused with a retryable code.
  const early = await post("/api/inspections", token, {
    clientId: uid(),
    harvestClientId,
    inspectionDate: "2026-11-16",
    grade: "A"
  });
  assert.equal(early.status, 409);
  assert.equal(early.body.error.code, "PARENT_NOT_SYNCED");

  await post("/api/harvests", token, {
    clientId: harvestClientId,
    farmClientId: farm.clientId,
    crop: "Rice",
    harvestDate: "2026-11-15",
    quantity: 10,
    unit: "bags"
  });
  const check = await post("/api/inspections", token, {
    clientId: uid(),
    harvestClientId,
    inspectionDate: "2026-11-16",
    grade: "B",
    checks: { dry: true, clean: true, no_pests: false, made_up: true },
    moisturePercent: 14
  });
  assert.equal(check.status, 201);
  assert.deepEqual(check.body.record.checks, { dry: true, clean: true, no_pests: false });
  assert.equal(check.body.record.harvestClientId, harvestClientId);

  const badGrade = await post("/api/inspections", token, {
    clientId: uid(),
    harvestClientId,
    inspectionDate: "2026-11-16",
    grade: "Z"
  });
  assert.equal(badGrade.status, 400);
});

test("sales, payments and expenses add up per currency", async () => {
  const { token } = await registerFarmer("0772220004");
  const farm = await createFarm(token);
  const harvestClientId = uid();
  await post("/api/harvests", token, {
    clientId: harvestClientId,
    farmClientId: farm.clientId,
    crop: "Rice",
    harvestDate: "2026-11-01",
    quantity: 20,
    unit: "bags"
  });
  const buyerClientId = uid();
  const buyer = await post("/api/buyers", token, {
    clientId: buyerClientId,
    name: "Ma Hawa",
    buyerType: "market_woman",
    phoneNumber: "0775550000"
  });
  assert.equal(buyer.status, 201);
  assert.equal(buyer.body.record.phoneNumber, "+231775550000");

  const saleClientId = uid();
  const sale = await post("/api/sales", token, {
    clientId: saleClientId,
    harvestClientId,
    buyerClientId,
    saleDate: "2026-11-05",
    crop: "Rice",
    quantity: 5,
    unit: "bags",
    unitPrice: 3000,
    currency: "LRD"
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.body.record.totalAmount, 15000);

  const noPrice = await post("/api/sales", token, {
    clientId: uid(),
    saleDate: "2026-11-05",
    crop: "Rice",
    quantity: 1,
    unit: "bags",
    currency: "LRD"
  });
  assert.equal(noPrice.status, 400);

  // A USD sale with a lump total and no buyer.
  await post("/api/sales", token, {
    clientId: uid(),
    saleDate: "2026-11-06",
    crop: "Pepper",
    quantity: 2,
    unit: "buckets",
    totalAmount: 40,
    currency: "USD"
  });

  const payment = await post("/api/payments", token, {
    clientId: uid(),
    saleClientId,
    amount: 10000,
    paidDate: "2026-11-05",
    method: "mobile_money"
  });
  assert.equal(payment.status, 201);
  const zero = await post("/api/payments", token, {
    clientId: uid(),
    saleClientId,
    amount: 0,
    paidDate: "2026-11-05"
  });
  assert.equal(zero.status, 400);

  await post("/api/expenses", token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    expenseDate: "2026-10-01",
    category: "fertilizer",
    amount: 4000,
    currency: "LRD"
  });
  await post("/api/expenses", token, {
    clientId: uid(),
    expenseDate: "2026-10-02",
    category: "labour",
    amount: 1500,
    currency: "LRD"
  });

  const summary = await api(server.baseUrl, "/api/reports/summary", { token });
  assert.equal(summary.status, 200);
  const { money } = summary.body;
  assert.deepEqual(money.sold, { LRD: 15000, USD: 40 });
  assert.deepEqual(money.received, { LRD: 10000, USD: 0 });
  assert.deepEqual(money.owed, { LRD: 5000, USD: 40 });
  assert.deepEqual(money.spent, { LRD: 5500, USD: 0 });
  assert.deepEqual(money.profit, { LRD: 4500, USD: 0 });
  assert.deepEqual(summary.body.harvest, [{ crop: "Rice", unit: "bags", quantity: 20, batches: 1 }]);

  // Changing the price recomputes the total.
  const updated = await api(server.baseUrl, `/api/sales/${sale.body.record.id}`, {
    method: "PATCH",
    token,
    body: { unitPrice: 2000 }
  });
  assert.equal(updated.body.record.totalAmount, 10000);

  // Deleting the payment moves the money back to "owed"; a replay stays deleted.
  const removed = await api(server.baseUrl, `/api/payments/${payment.body.record.id}`, {
    method: "DELETE",
    token
  });
  assert.equal(removed.status, 200);
  const replay = await post("/api/payments", token, {
    clientId: payment.body.record.clientId,
    saleClientId,
    amount: 10000,
    paidDate: "2026-11-05"
  });
  assert.equal(replay.body.deleted, true);
  const after = await api(server.baseUrl, "/api/reports/summary?from=2026-11-01", { token });
  assert.deepEqual(after.body.money.received, { LRD: 0, USD: 0 });
  assert.deepEqual(after.body.money.owed, { LRD: 10000, USD: 40 });
  assert.deepEqual(after.body.money.spent, { LRD: 0, USD: 0 });
});

test("farmers cannot read or link to another farmer's records", async () => {
  const one = await registerFarmer("0772220005", "One Farmer");
  const two = await registerFarmer("0772220006", "Two Farmer");
  const farm = await createFarm(one.token, { crops: ["Rice", "Cassava"] });
  const harvest = await post("/api/harvests", one.token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    crop: "Cassava",
    harvestDate: "2026-11-02",
    quantity: 3,
    unit: "bags"
  });

  const read = await api(server.baseUrl, `/api/harvests/${harvest.body.record.id}`, { token: two.token });
  assert.equal(read.status, 404);
  const list = await api(server.baseUrl, "/api/harvests", { token: two.token });
  assert.equal(list.body.items.length, 0);

  const link = await post("/api/sales", two.token, {
    clientId: uid(),
    harvestClientId: harvest.body.record.clientId,
    saleDate: "2026-11-03",
    crop: "Cassava",
    quantity: 1,
    unit: "bags",
    totalAmount: 100,
    currency: "LRD"
  });
  assert.equal(link.status, 409);

  const farmLink = await post("/api/harvests", two.token, {
    clientId: uid(),
    farmClientId: farm.clientId,
    crop: "Cassava",
    harvestDate: "2026-11-02",
    quantity: 1,
    unit: "bags"
  });
  assert.equal(farmLink.status, 409);

  const change = await api(server.baseUrl, `/api/harvests/${harvest.body.record.id}`, {
    method: "PATCH",
    token: two.token,
    body: { quantity: 0 }
  });
  assert.equal(change.status, 404);
});

test("the Harvest Passport is public only when the farmer turns it on", async () => {
  const { token, user } = await registerFarmer("0772220007", "Martha Nyema Sumo");
  const farm = await createFarm(token, { size: 2, sizeUnit: "acres" });
  await post("/api/activities", token, {
    clientId: uid(),
    farmId: farm.id,
    activityType: "fertilizer_application",
    activityDate: "2026-08-01",
    inputUsed: "NPK"
  });
  const harvestClientId = uid();
  const harvest = await post("/api/harvests", token, {
    clientId: harvestClientId,
    farmClientId: farm.clientId,
    crop: "Rice",
    harvestDate: "2026-11-01",
    quantity: 8,
    unit: "bags"
  });
  const code = harvest.body.record.passportCode;

  const hidden = await api(server.baseUrl, `/api/passport/${code}`);
  assert.equal(hidden.status, 404);
  const invalid = await api(server.baseUrl, "/api/passport/not-a-code");
  assert.equal(invalid.status, 400);

  await post("/api/inspections", token, {
    clientId: uid(),
    harvestClientId,
    inspectionDate: "2026-11-02",
    grade: "A",
    checks: { dry: true, clean: true }
  });
  await api(server.baseUrl, `/api/harvests/${harvest.body.record.id}`, {
    method: "PATCH",
    token,
    body: { passportPublic: true }
  });

  const shown = await api(server.baseUrl, `/api/passport/${code.toLowerCase()}`);
  assert.equal(shown.status, 200);
  const { passport } = shown.body;
  assert.equal(passport.crop, "Rice");
  assert.equal(passport.farmer.firstName, "Martha");
  assert.equal(passport.quality.grade, "A");
  assert.equal(passport.farm.size, 2);
  assert.equal(passport.farmWork.length, 1);
  assert.equal(passport.farmWork[0].inputUsed, "NPK");
  const raw = JSON.stringify(shown.body);
  assert.ok(!raw.includes(user.phoneNumber), "phone number must not be public");
  assert.ok(!raw.includes("Sumo"), "full name must not be public");
  assert.ok(!raw.includes(user.id), "farmer id must not be public");
});

test("cooperatives: admins manage groups, farmers join by code, leaders see members", async () => {
  const { pin } = await createAdminRecord();
  const adminToken = (await loginAs(server.baseUrl, "MND-TESTADMIN", pin)).body.token;
  const leader = await registerFarmer("0772220010", "Leader Farmer");
  const member = await registerFarmer("0772220011", "Member Farmer");
  const outsider = await registerFarmer("0772220012", "Outside Farmer");

  const created = await post("/api/admin/cooperatives", adminToken, {
    name: "Gbarnga Rice Group",
    county: "Bong",
    district: "Gbarnga"
  });
  assert.equal(created.status, 201);
  const coop = created.body.cooperative;
  assert.match(coop.joinCode, /^GRP-[A-Z0-9]{6}$/);

  const added = await post(`/api/admin/cooperatives/${coop.id}/members`, adminToken, {
    phoneNumber: "0772220010",
    role: "leader"
  });
  assert.equal(added.status, 201);
  const unknown = await post(`/api/admin/cooperatives/${coop.id}/members`, adminToken, {
    phoneNumber: "0779999999"
  });
  assert.equal(unknown.status, 404);

  const noConsent = await post("/api/cooperatives/join", member.token, {
    joinCode: coop.joinCode
  });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.body.error.details.field, "consent");

  const joined = await post("/api/cooperatives/join", member.token, {
    joinCode: coop.joinCode.replace("GRP-", "").toLowerCase(),
    consent: true
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.cooperative.joinCode, undefined);
  assert.equal(joined.body.cooperative.myConsent, true);
  const again = await post("/api/cooperatives/join", member.token, {
    joinCode: coop.joinCode,
    consent: true
  });
  assert.equal(again.status, 409);
  const wrong = await post("/api/cooperatives/join", member.token, {
    joinCode: "GRP-ZZZZZZ",
    consent: true
  });
  assert.equal(wrong.status, 404);

  // The member sells something; the group totals include it.
  await post("/api/sales", member.token, {
    clientId: uid(),
    saleDate: "2026-11-05",
    crop: "Rice",
    quantity: 2,
    unit: "bags",
    totalAmount: 6000,
    currency: "LRD"
  });

  const memberView = await api(server.baseUrl, `/api/cooperatives/${coop.id}/dashboard`, {
    token: member.token
  });
  assert.equal(memberView.status, 200);
  assert.equal(memberView.body.myRole, "member");
  assert.equal(memberView.body.myConsent, true);
  assert.equal(memberView.body.members, undefined);
  assert.equal(memberView.body.cooperative.joinCode, undefined);
  assert.equal(memberView.body.groupTotals.money.sold.LRD, 6000);
  assert.equal(memberView.body.myTotals.money.sold.LRD, 6000);
  assert.equal(memberView.body.leaders[0].fullName, "Leader Farmer");

  const leaderView = await api(server.baseUrl, `/api/cooperatives/${coop.id}/dashboard`, {
    token: leader.token
  });
  assert.equal(leaderView.body.myRole, "leader");
  assert.equal(leaderView.body.myConsent, false, "an admin-added leader did not agree to share");
  assert.equal(leaderView.body.members.length, 2);
  const sharedMember = leaderView.body.members.find((m) => m.fullName === "Member Farmer");
  assert.equal(sharedMember.sharesTotals, true);
  assert.equal(sharedMember.sold.LRD, 6000);
  const unsharedLeader = leaderView.body.members.find((m) => m.fullName === "Leader Farmer");
  assert.equal(unsharedLeader.sharesTotals, false);
  assert.equal(unsharedLeader.sold, undefined);
  assert.ok(leaderView.body.members.every((m) => m.phoneNumber === undefined));
  assert.ok(leaderView.body.members.every((m) => m.farmCount === undefined));
  assert.ok(leaderView.body.cooperative.joinCode);

  const optOut = await post(`/api/cooperatives/${coop.id}/consent`, member.token, { consent: false });
  assert.equal(optOut.status, 200);
  assert.equal(optOut.body.myConsent, false);
  const leaderAfterOptOut = await api(server.baseUrl, `/api/cooperatives/${coop.id}/dashboard`, {
    token: leader.token
  });
  const hiddenMember = leaderAfterOptOut.body.members.find((m) => m.fullName === "Member Farmer");
  assert.equal(hiddenMember.sharesTotals, false);
  assert.equal(hiddenMember.sold, undefined);
  assert.equal(leaderAfterOptOut.body.groupTotals.money.sold.LRD, 6000, "group totals still include everyone");
  await post(`/api/cooperatives/${coop.id}/consent`, member.token, { consent: true });

  const outsiderView = await api(server.baseUrl, `/api/cooperatives/${coop.id}/dashboard`, {
    token: outsider.token
  });
  assert.equal(outsiderView.status, 403);
  const farmerAdmin = await api(server.baseUrl, "/api/admin/cooperatives", { token: member.token });
  assert.equal(farmerAdmin.status, 403);

  const adminView = await api(server.baseUrl, `/api/admin/cooperatives/${coop.id}`, { token: adminToken });
  assert.equal(adminView.body.members.length, 2);
  assert.equal(adminView.body.cooperative.memberCount, 2);
  assert.equal(adminView.body.totals.money.sold.LRD, 6000);
  assert.ok(
    adminView.body.members.every(
      (m) => m.phoneNumber === undefined && m.sold === undefined && m.farmCount === undefined
    ),
    "admins see who is in the group, not an individual's business"
  );
  assert.equal(
    adminView.body.members.find((m) => m.fullName === "Member Farmer").sharesTotals,
    true
  );

  const promoted = await api(server.baseUrl, `/api/admin/cooperatives/${coop.id}/members/${member.user.id}`, {
    method: "PATCH",
    token: adminToken,
    body: { role: "leader" }
  });
  assert.equal(promoted.status, 200);

  const left = await post(`/api/cooperatives/${coop.id}/leave`, member.token);
  assert.equal(left.status, 200);
  const mine = await api(server.baseUrl, "/api/cooperatives/mine", { token: member.token });
  assert.equal(mine.body.items.length, 0);

  const removed = await api(server.baseUrl, `/api/admin/cooperatives/${coop.id}/members/${leader.user.id}`, {
    method: "DELETE",
    token: adminToken
  });
  assert.equal(removed.status, 200);

  const { rows } = await query(
    "SELECT action FROM audit_logs WHERE target_type = 'cooperative' ORDER BY created_at"
  );
  assert.deepEqual(
    rows.map((row) => row.action),
    [
      "cooperative.created",
      "cooperative.member_added",
      "cooperative.viewed",
      "cooperative.member_role",
      "cooperative.member_removed"
    ]
  );

  const dashboard = await api(server.baseUrl, "/api/admin/dashboard", { token: adminToken });
  assert.equal(dashboard.body.metrics.totalCooperatives, 1);
  assert.equal(dashboard.body.metrics.totalSales, 1);
});
