import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
  api,
  closeDatabase,
  createAdminRecord,
  loginAs,
  resetDatabase,
  startServer
} from "./helpers.js";

let server;
let farmerToken;
let otherFarmerToken;
let adminToken;
let otherFarmerId;

const farmerBody = {
  fullName: "Samuel Duo",
  phoneNumber: "0771110001",
  county: "Grand Bassa",
  district: "Buchanan",
  community: "Buchanan",
  pin: "1357",
  confirmPin: "1357"
};

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
  const farmer = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: farmerBody
  });
  farmerToken = farmer.body.token;

  const other = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...farmerBody, fullName: "Other Farmer", phoneNumber: "0771110002" }
  });
  otherFarmerToken = other.body.token;
  otherFarmerId = other.body.user.id;

  const admin = await createAdminRecord({ accessCode: "MND-RBAC-TEST" });
  const adminLogin = await loginAs(server.baseUrl, "MND-RBAC-TEST", admin.pin);
  adminToken = adminLogin.body.token;
});

after(async () => {
  await server.close();
  await closeDatabase();
});

test("unauthenticated requests are rejected", async () => {
  const farms = await api(server.baseUrl, "/api/farms");
  assert.equal(farms.status, 401);
  const dashboard = await api(server.baseUrl, "/api/admin/dashboard");
  assert.equal(dashboard.status, 401);

  const badToken = await api(server.baseUrl, "/api/farms", { token: "not-a-real-token" });
  assert.equal(badToken.status, 401);
});

test("farmers cannot access admin APIs", async () => {
  for (const path of [
    "/api/admin/dashboard",
    "/api/admin/farmers",
    `/api/admin/farmers/${otherFarmerId}`
  ]) {
    const result = await api(server.baseUrl, path, { token: farmerToken });
    assert.equal(result.status, 403, path);
    assert.equal(result.body.error.code, "FORBIDDEN");
  }

  const deactivate = await api(
    server.baseUrl,
    `/api/admin/farmers/${otherFarmerId}/deactivate`,
    { method: "POST", token: farmerToken }
  );
  assert.equal(deactivate.status, 403);
});

test("administrators cannot use farmer APIs", async () => {
  const farms = await api(server.baseUrl, "/api/farms", { token: adminToken });
  assert.equal(farms.status, 403);

  const activities = await api(server.baseUrl, "/api/activities", { token: adminToken });
  assert.equal(activities.status, 403);

  const create = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token: adminToken,
    body: {
      farmName: "Admin Farm",
      county: "Bong",
      district: "Gbarnga",
      community: "Gbarnga",
      farmType: "crop_farming"
    }
  });
  assert.equal(create.status, 403);
});

test("farm and activity records are scoped to their owner", async () => {
  const created = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token: farmerToken,
    body: {
      farmName: "Private Farm",
      county: "Bong",
      district: "Gbarnga",
      community: "Gbarnga",
      farmType: "crop_farming"
    }
  });
  assert.equal(created.status, 201);
  const farmId = created.body.farm.id;

  const otherList = await api(server.baseUrl, "/api/farms", { token: otherFarmerToken });
  assert.equal(otherList.status, 200);
  assert.equal(otherList.body.farms.length, 0);

  const read = await api(server.baseUrl, `/api/farms/${farmId}`, { token: otherFarmerToken });
  assert.equal(read.status, 404);

  const update = await api(server.baseUrl, `/api/farms/${farmId}`, {
    method: "PATCH",
    token: otherFarmerToken,
    body: { farmName: "Stolen Farm" }
  });
  assert.equal(update.status, 404);

  const activity = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token: otherFarmerToken,
    body: {
      clientId: "other-client-record-1",
      farmId,
      activityType: "planting",
      activityDate: "2026-11-01",
      description: "Trying to record on another farm"
    }
  });
  assert.equal(activity.status, 404);

  const ownActivity = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token: farmerToken,
    body: {
      clientId: "own-client-record-1",
      farmId,
      activityType: "planting",
      activityDate: "2026-11-01",
      description: "Recorded by the owner"
    }
  });
  assert.equal(ownActivity.status, 201);

  const steal = await api(server.baseUrl, `/api/activities/${ownActivity.body.activity.id}`, {
    method: "DELETE",
    token: otherFarmerToken
  });
  assert.equal(steal.status, 404);
});

test("deactivated farmers lose access immediately and cannot sign in", async () => {
  const admin = await createAdminRecord({
    accessCode: "MND-RBAC-TEST-2",
    phoneNumber: "+231770009998"
  });
  const secondAdmin = await loginAs(server.baseUrl, "MND-RBAC-TEST-2", admin.pin);
  const meBefore = await api(server.baseUrl, "/api/auth/me", { token: otherFarmerToken });
  const farmerId = meBefore.body.user.id;

  const deactivate = await api(server.baseUrl, `/api/admin/farmers/${farmerId}/deactivate`, {
    method: "POST",
    token: secondAdmin.body.token
  });
  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.body.farmer.status, "inactive");

  const existingSession = await api(server.baseUrl, "/api/farms", { token: otherFarmerToken });
  assert.equal(existingSession.status, 401);

  const login = await loginAs(server.baseUrl, "0771110002", "1357");
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, "ACCOUNT_INACTIVE");

  const reactivate = await api(server.baseUrl, `/api/admin/farmers/${farmerId}/reactivate`, {
    method: "POST",
    token: secondAdmin.body.token
  });
  assert.equal(reactivate.status, 200);

  const relogin = await loginAs(server.baseUrl, "0771110002", "1357");
  assert.equal(relogin.status, 200);
});
