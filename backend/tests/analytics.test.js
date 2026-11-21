import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, createAdminRecord, loginAs, query, resetDatabase, startServer } from "./helpers.js";

let server;
let adminToken;

const uid = () => `client-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
const post = (path, token, body) => api(server.baseUrl, path, { method: "POST", token, body });

async function registerFarmer(phoneNumber, county, fullName = "Test Farmer") {
  const result = await post("/api/auth/register", null, {
    fullName,
    phoneNumber,
    county,
    district: "Central",
    community: "Town",
    pin: "1122",
    confirmPin: "1122"
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

async function createFarm(token, county, overrides = {}) {
  const result = await post("/api/farms", token, {
    clientId: uid(),
    farmName: "Farm",
    county,
    district: "Central",
    community: "Town",
    farmType: "crop_farming",
    mainCropOrLivestock: "Rice",
    ...overrides
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.farm;
}

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
  const { pin } = await createAdminRecord();
  adminToken = (await loginAs(server.baseUrl, "MND-TESTADMIN", pin)).body.token;
});

after(async () => {
  await server.close();
  await closeDatabase();
});

async function seed() {
  const bong = await registerFarmer("0772000001", "Bong", "Esther Kollie");
  const nimba = await registerFarmer("0772000002", "Nimba", "=HYPERLINK(\"x\")");
  const bongFarm = await createFarm(bong.token, "Bong", { size: 2, sizeUnit: "hectares" });
  await createFarm(bong.token, "Bong", { size: 10, sizeUnit: "acres", mainCropOrLivestock: " cassava " });
  await createFarm(nimba.token, "Nimba", { size: 3, sizeUnit: "lots", farmType: "poultry", mainCropOrLivestock: "Chicken" });

  const activity = await post("/api/activities", bong.token, {
    clientId: uid(),
    farmId: bongFarm.id,
    activityType: "planting",
    activityDate: "2026-03-10"
  });
  assert.equal(activity.status, 201, JSON.stringify(activity.body));

  const harvestClientId = uid();
  const harvest = await post("/api/harvests", bong.token, {
    clientId: harvestClientId,
    farmClientId: bongFarm.clientId,
    crop: "Rice",
    harvestDate: "2026-04-02",
    quantity: 20,
    unit: "bags"
  });
  assert.equal(harvest.status, 201, JSON.stringify(harvest.body));
  await post("/api/inspections", bong.token, {
    clientId: uid(),
    harvestClientId,
    inspectionDate: "2026-04-03",
    grade: "A"
  });
  const sale = await post("/api/sales", bong.token, {
    clientId: uid(),
    harvestClientId,
    saleDate: "2026-04-05",
    crop: "Rice",
    quantity: 5,
    unit: "bags",
    unitPrice: 3000,
    currency: "LRD"
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.body));

  const coop = await post("/api/admin/cooperatives", adminToken, { name: "Bong Rice Growers", county: "Bong" });
  assert.equal(coop.status, 201, JSON.stringify(coop.body));
  const coopId = coop.body.cooperative.id;
  await post(`/api/admin/cooperatives/${coopId}/members`, adminToken, { phoneNumber: "0772000001" });
  return { bong, nimba, coopId };
}

test("analytics is admin-only and validates its filters", async () => {
  const farmer = await registerFarmer("0772000009", "Bong");
  const denied = await api(server.baseUrl, "/api/admin/analytics", { token: farmer.token });
  assert.equal(denied.status, 403);
  const anonymous = await api(server.baseUrl, "/api/admin/analytics");
  assert.equal(anonymous.status, 401);

  const badCounty = await api(server.baseUrl, "/api/admin/analytics?county=Atlantis", { token: adminToken });
  assert.equal(badCounty.status, 400);
  const backwards = await api(server.baseUrl, "/api/admin/analytics?from=2026-05-01&to=2026-01-01", { token: adminToken });
  assert.equal(backwards.status, 400);
  const tooLong = await api(server.baseUrl, "/api/admin/analytics?from=2020-01-01&to=2026-01-01", { token: adminToken });
  assert.equal(tooLong.status, 400);

  const empty = await api(server.baseUrl, "/api/admin/analytics", { token: adminToken });
  assert.equal(empty.status, 200);
  assert.equal(empty.body.monthly.length, 12);
  assert.equal(empty.body.counties.length, 15);
});

test("analytics totals, monthly series and county rows reconcile", async () => {
  await seed();
  const range = "from=2026-01-01&to=2026-06-30";
  const all = await api(server.baseUrl, `/api/admin/analytics?${range}`, { token: adminToken });
  assert.equal(all.status, 200, JSON.stringify(all.body));
  const { kpis, monthly, counties } = all.body;

  assert.equal(kpis.farmers, 2);
  assert.equal(kpis.farms, 3);
  // 2 ha + 10 acres (4.05 ha); lots kept apart
  assert.equal(kpis.areaHectares, 6);
  assert.equal(kpis.lots, 3);
  assert.equal(kpis.cooperatives, 1);
  assert.equal(kpis.coopMembers, 1);
  assert.equal(kpis.coopCoveragePercent, 50);
  assert.equal(kpis.activities, 1);
  assert.equal(kpis.harvests, 1);
  assert.equal(kpis.sales, 1);
  assert.equal(kpis.money.sold.LRD, 15000);
  assert.equal(kpis.money.sold.USD, 0);

  assert.equal(monthly.length, 6);
  assert.deepEqual(monthly.map((m) => m.month), ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  assert.equal(monthly.find((m) => m.month === "2026-03").activities, 1);
  assert.equal(monthly.find((m) => m.month === "2026-04").soldLRD, 15000);
  assert.equal(monthly.reduce((sum, m) => sum + m.harvests, 0), kpis.harvests);

  assert.equal(counties.reduce((sum, c) => sum + c.farmers, 0), kpis.farmers);
  assert.equal(counties.reduce((sum, c) => sum + c.farms, 0), kpis.farms);
  const bongRow = counties.find((c) => c.county === "Bong");
  assert.equal(bongRow.soldLRD, 15000);
  assert.equal(bongRow.coopMembers, 1);

  assert.deepEqual(all.body.grades, { A: 1, B: 0, C: 0, rejected: 0 });
  assert.ok(all.body.crops.some((c) => c.crop === "Cassava"));
  assert.ok(all.body.farmTypes.some((t) => t.type === "poultry" && t.count === 1));
  assert.equal(all.body.cooperatives[0].members, 1);
  assert.equal(all.body.cooperatives[0].soldLRD, 15000);
  assert.equal(all.body.engagement.last7Days, 1);
  assert.equal(all.body.engagement.dormant, 1);

  const nimba = await api(server.baseUrl, `/api/admin/analytics?${range}&county=Nimba`, { token: adminToken });
  assert.equal(nimba.body.kpis.farmers, 1);
  assert.equal(nimba.body.kpis.money.sold.LRD, 0);
  assert.equal(nimba.body.kpis.cooperatives, 0);

  const outside = await api(server.baseUrl, "/api/admin/analytics?from=2026-07-01&to=2026-07-31", { token: adminToken });
  assert.equal(outside.body.kpis.harvests, 0);
  assert.equal(outside.body.kpis.farmers, 2, "stock numbers ignore the period");
});

test("CSV exports are safe, filtered and audited", async () => {
  await seed();
  const response = await fetch(`${server.baseUrl}/api/admin/exports/farmers.csv?from=2026-01-01&to=2026-06-30`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.match(response.headers.get("content-disposition"), /minders-farmers-2026-01-01_to_2026-06-30\.csv/);
  const text = await response.text();
  const lines = text.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith("Full name,Phone,County"));
  assert.ok(text.includes("+231772000001"), "phone numbers are not mangled");
  assert.ok(text.includes(`"'=HYPERLINK(""x"")"`), "formula cells are neutralised");
  assert.ok(!/pin|security/i.test(lines[0]));
  assert.ok(text.includes("Bong Rice Growers"));

  const counties = await fetch(`${server.baseUrl}/api/admin/exports/counties`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal((await counties.text()).trim().split("\r\n").length, 16);

  const unknown = await api(server.baseUrl, "/api/admin/exports/passwords", { token: adminToken });
  assert.equal(unknown.status, 400);

  const farmer = await registerFarmer("0772000010", "Bong");
  const denied = await api(server.baseUrl, "/api/admin/exports/farmers", { token: farmer.token });
  assert.equal(denied.status, 403);

  const audit = await query(`SELECT target_id FROM audit_logs WHERE action = 'data_exported' ORDER BY created_at`);
  assert.deepEqual(audit.rows.map((r) => r.target_id), ["farmers", "counties"]);
});
