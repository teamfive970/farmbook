import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
  api,
  closeDatabase,
  createAdminRecord,
  loginAs,
  query,
  resetDatabase,
  startServer
} from "./helpers.js";

let server;
let adminToken;
let adminId;

const farmerRegistration = {
  fullName: "Grace Tarr",
  phoneNumber: "0773330001",
  county: "Montserrado",
  district: "Careysburg",
  community: "Careysburg",
  pin: "9090",
  confirmPin: "9090"
};

async function registerFarmer(overrides = {}) {
  return api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...farmerRegistration, ...overrides }
  });
}

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
  const { admin, pin } = await createAdminRecord({
    displayName: "National Admin",
    accessCode: "MND-ADMIN-TEST",
    phoneNumber: "+231770008888"
  });
  adminId = admin.id;
  const login = await loginAs(server.baseUrl, "MND-ADMIN-TEST", pin);
  adminToken = login.body.token;
});

after(async () => {
  await server.close();
  await closeDatabase();
});

test("admin dashboard reports live platform metrics", async () => {
  const farmer = await registerFarmer();
  const farmerToken = farmer.body.token;
  await registerFarmer({ phoneNumber: "0773330002", fullName: "Prince Toe" });

  const farm = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token: farmerToken,
    body: {
      farmName: "Grace Farm",
      county: "Montserrado",
      district: "Careysburg",
      community: "Careysburg",
      farmType: "mixed_farming"
    }
  });
  await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token: farmerToken,
    body: {
      clientId: "dashboard-client-1",
      farmId: farm.body.farm.id,
      activityType: "planting",
      activityDate: "2026-11-15",
      description: "Planted maize."
    }
  });

  const dashboard = await api(server.baseUrl, "/api/admin/dashboard", { token: adminToken });
  assert.equal(dashboard.status, 200);
  assert.deepEqual(
    {
      totalFarmers: dashboard.body.metrics.totalFarmers,
      activeFarmers: dashboard.body.metrics.activeFarmers,
      totalFarms: dashboard.body.metrics.totalFarms,
      totalActivities: dashboard.body.metrics.totalActivities,
      activitiesThisWeek: dashboard.body.metrics.activitiesThisWeek,
      farmersThisMonth: dashboard.body.metrics.farmersThisMonth
    },
    {
      totalFarmers: 2,
      activeFarmers: 2,
      totalFarms: 1,
      totalActivities: 1,
      activitiesThisWeek: 1,
      farmersThisMonth: 2
    }
  );
  assert.equal(dashboard.body.recentFarmers.length, 2);
  assert.equal(dashboard.body.recentFarmers[0].phoneNumber, "+231773330002");
});

test("admin farmer list supports search, county, status and pagination", async () => {
  await registerFarmer();
  await registerFarmer({ phoneNumber: "0773330002", fullName: "Prince Toe", county: "Nimba" });
  await registerFarmer({ phoneNumber: "0773330003", fullName: "Hawa Kamara", county: "Nimba" });

  const all = await api(server.baseUrl, "/api/admin/farmers", { token: adminToken });
  assert.equal(all.status, 200);
  assert.equal(all.body.pagination.total, 3);

  const byName = await api(server.baseUrl, "/api/admin/farmers?search=grace", { token: adminToken });
  assert.equal(byName.body.items.length, 1);
  assert.equal(byName.body.items[0].fullName, "Grace Tarr");

  const byPhone = await api(server.baseUrl, "/api/admin/farmers?search=3330003", {
    token: adminToken
  });
  assert.equal(byPhone.body.items.length, 1);

  const byCounty = await api(server.baseUrl, "/api/admin/farmers?county=Nimba", {
    token: adminToken
  });
  assert.equal(byCounty.body.items.length, 2);

  const paged = await api(server.baseUrl, "/api/admin/farmers?page=1&pageSize=2", {
    token: adminToken
  });
  assert.equal(paged.body.items.length, 2);
  assert.equal(paged.body.pagination.total, 3);

  const badStatus = await api(server.baseUrl, "/api/admin/farmers?status=pending", {
    token: adminToken
  });
  assert.equal(badStatus.status, 400);
});

test("admin can view, edit and deactivate a farmer with audit logging", async () => {
  const farmer = await registerFarmer();
  const farmerId = farmer.body.user.id;
  const farmerToken = farmer.body.token;

  const farm = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token: farmerToken,
    body: {
      farmName: "Tarr Family Farm",
      county: "Montserrado",
      district: "Careysburg",
      community: "Careysburg",
      farmType: "crop_farming",
      mainCropOrLivestock: "Cassava"
    }
  });
  await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token: farmerToken,
    body: {
      clientId: "admin-detail-client-1",
      farmId: farm.body.farm.id,
      activityType: "weeding",
      activityDate: "2026-11-08",
      description: "Weeded the cassava."
    }
  });

  const detail = await api(server.baseUrl, `/api/admin/farmers/${farmerId}`, { token: adminToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.farmer.fullName, "Grace Tarr");
  assert.equal(detail.body.farmer.farmCount, 1);
  assert.equal(detail.body.farmer.activityCount, 1);
  assert.equal(detail.body.farms.length, 1);
  assert.equal(detail.body.recentActivities.length, 1);

  const updated = await api(server.baseUrl, `/api/admin/farmers/${farmerId}`, {
    method: "PATCH",
    token: adminToken,
    body: { community: "Harrisburg", fullName: "Grace Tarr-Kollie" }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.farmer.community, "Harrisburg");
  assert.equal(updated.body.farmer.fullName, "Grace Tarr-Kollie");

  const { rows: updateAudit } = await query(
    "SELECT action, admin_user_id FROM audit_logs WHERE target_id = $1 ORDER BY created_at",
    [farmerId]
  );
  assert.equal(updateAudit.length, 1);
  assert.equal(updateAudit[0].action, "farmer.updated");
  assert.equal(updateAudit[0].admin_user_id, adminId);

  const deactivate = await api(server.baseUrl, `/api/admin/farmers/${farmerId}/deactivate`, {
    method: "POST",
    token: adminToken
  });
  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.body.farmer.status, "inactive");

  const blocked = await api(server.baseUrl, "/api/auth/me", { token: farmerToken });
  assert.equal(blocked.status, 401);

  const inactiveList = await api(server.baseUrl, "/api/admin/farmers?status=inactive", {
    token: adminToken
  });
  assert.equal(inactiveList.body.items.length, 1);

  const reactivate = await api(server.baseUrl, `/api/admin/farmers/${farmerId}/reactivate`, {
    method: "POST",
    token: adminToken
  });
  assert.equal(reactivate.status, 200);
  assert.equal(reactivate.body.farmer.status, "active");

  const { rows: statusAudit } = await query(
    "SELECT action FROM audit_logs WHERE target_id = $1 ORDER BY created_at",
    [farmerId]
  );
  assert.deepEqual(
    statusAudit.map((row) => row.action),
    ["farmer.updated", "farmer.deactivated", "farmer.reactivated"]
  );
});

test("admin can rotate access code, PIN and add a phone number", async () => {
  const rotate = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token: adminToken,
    body: {
      currentPin: "246810",
      newAccessCode: "MND-ROTATED-2026",
      newPin: "864209",
      confirmPin: "864209",
      phoneNumber: "0778887777"
    }
  });
  assert.equal(rotate.status, 200);
  assert.equal(rotate.body.admin.phoneNumber, "+231778887777");

  const oldCode = await loginAs(server.baseUrl, "MND-ADMIN-TEST", "246810");
  assert.equal(oldCode.status, 401);

  const newCodeOldPin = await loginAs(server.baseUrl, "MND-ROTATED-2026", "246810");
  assert.equal(newCodeOldPin.status, 401);

  const newCodeNewPin = await loginAs(server.baseUrl, "MND-ROTATED-2026", "864209");
  assert.equal(newCodeNewPin.status, 200);
  assert.equal(newCodeNewPin.body.user.role, "admin");

  // The phone is for SMS recovery only; admins sign in with the access code.
  const phoneLogin = await loginAs(server.baseUrl, "0778887777", "864209");
  assert.equal(phoneLogin.status, 401);

  const shortPin = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token: newCodeNewPin.body.token,
    body: { currentPin: "864209", newPin: "1357", confirmPin: "1357" }
  });
  assert.equal(shortPin.status, 400);
  assert.equal(shortPin.body.error.details.field, "newPin");

  const { rows: audit } = await query(
    "SELECT action, metadata FROM audit_logs WHERE admin_user_id = $1",
    [adminId]
  );
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "admin.credentials_updated");
  assert.deepEqual(audit[0].metadata.changed.sort(), ["accessCode", "phoneNumber", "pin"]);

  const wrongPin = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token: newCodeNewPin.body.token,
    body: { currentPin: "000000", newAccessCode: "MND-SHOULD-NOT-WORK" }
  });
  assert.equal(wrongPin.status, 400);

  await createAdminRecord({ accessCode: "MND-TAKEN-CODE" });
  const collision = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token: newCodeNewPin.body.token,
    body: { currentPin: "864209", newAccessCode: "MND-TAKEN-CODE" }
  });
  assert.equal(collision.status, 409);
});

test("admin endpoints validate ids and payloads", async () => {
  const badId = await api(server.baseUrl, "/api/admin/farmers/not-a-uuid", { token: adminToken });
  assert.equal(badId.status, 400);

  const missing = await api(
    server.baseUrl,
    "/api/admin/farmers/00000000-0000-4000-8000-000000000000",
    { token: adminToken }
  );
  assert.equal(missing.status, 404);

  const emptyUpdate = await api(
    server.baseUrl,
    "/api/admin/farmers/00000000-0000-4000-8000-000000000000",
    { method: "PATCH", token: adminToken, body: {} }
  );
  assert.equal(emptyUpdate.status, 400);

  const noCredentials = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token: adminToken,
    body: { currentPin: "246810" }
  });
  assert.equal(noCredentials.status, 400);
});
