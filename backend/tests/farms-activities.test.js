import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, resetDatabase, startServer } from "./helpers.js";

let server;
let token;

const registration = {
  fullName: "Esther Kollie",
  phoneNumber: "0772220001",
  county: "Bong",
  district: "Gbarnga",
  community: "Gbarnga",
  pin: "1122",
  confirmPin: "1122"
};

async function createFarm(overrides = {}) {
  const result = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token,
    body: {
      farmName: "River Side Farm",
      county: "Bong",
      district: "Gbarnga",
      community: "Gbarnga",
      farmType: "crop_farming",
      mainCropOrLivestock: "Rice",
      description: "Lowland rice field.",
      ...overrides
    }
  });
  return result;
}

async function createActivity(overrides = {}) {
  const farmId = overrides.farmId || (await createFarm()).body.farm.id;
  return api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: {
      clientId: `client-${Math.random().toString(16).slice(2)}`,
      farmId,
      activityType: "planting",
      activityDate: "2026-11-10",
      description: "Planted rice seedlings.",
      ...overrides
    }
  });
}

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
  const registered = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: registration
  });
  token = registered.body.token;
});

after(async () => {
  await server.close();
  await closeDatabase();
});

test("farms can be created, listed, read and edited", async () => {
  const created = await createFarm();
  assert.equal(created.status, 201);
  assert.equal(created.body.farm.farmName, "River Side Farm");
  assert.equal(created.body.farm.activityCount, 0);
  assert.equal(created.body.farm.farmType, "crop_farming");

  const list = await api(server.baseUrl, "/api/farms", { token });
  assert.equal(list.status, 200);
  assert.equal(list.body.farms.length, 1);

  const detail = await api(server.baseUrl, `/api/farms/${created.body.farm.id}`, { token });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.farm.description, "Lowland rice field.");

  const updated = await api(server.baseUrl, `/api/farms/${created.body.farm.id}`, {
    method: "PATCH",
    token,
    body: { farmName: "River Side Rice Farm", community: "Kpelleh Town" }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.farm.farmName, "River Side Rice Farm");
  assert.equal(updated.body.farm.community, "Kpelleh Town");
  assert.equal(updated.body.farm.mainCropOrLivestock, "Rice");
});

test("farm creation is idempotent when an offline queue retries", async () => {
  const clientId = "offline-farm-12345678";
  const payload = {
    clientId,
    farmName: "Offline Farm",
    county: "Lofa",
    district: "Voinjama",
    community: "Voinjama",
    farmType: "mixed_farming"
  };

  const first = await createFarm(payload);
  assert.equal(first.status, 201);
  assert.equal(first.body.created, true);
  assert.equal(first.body.farm.clientId, clientId);

  const retry = await createFarm({ ...payload, farmName: "Offline Farm Retried" });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.created, false);
  assert.equal(retry.body.farm.id, first.body.farm.id);
  assert.equal(retry.body.farm.farmName, "Offline Farm");

  const list = await api(server.baseUrl, "/api/farms", { token });
  assert.equal(list.body.farms.length, 1);
});

test("farm validation rejects bad input", async () => {
  const missingName = await createFarm({ farmName: "  " });
  assert.equal(missingName.status, 400);
  assert.equal(missingName.body.error.details.field, "farmName");

  const badType = await createFarm({ farmType: "space_farming" });
  assert.equal(badType.status, 400);

  const badCounty = await createFarm({ county: "Narnia" });
  assert.equal(badCounty.status, 400);

  const unknownFarm = await api(server.baseUrl, "/api/farms/00000000-0000-4000-8000-000000000000", {
    token
  });
  assert.equal(unknownFarm.status, 404);
});

test("activities are idempotent when the offline queue retries", async () => {
  const farm = await createFarm();
  const farmId = farm.body.farm.id;
  const payload = {
    clientId: "6c2e1b7a-0a55-4b6f-9e6b-123456789abc",
    farmId,
    activityType: "fertilizer_application",
    activityDate: "2026-11-12",
    description: "Applied NPK to the rice field.",
    inputUsed: "NPK 15-15-15",
    quantity: 25,
    unit: "kg",
    notes: "Half bag left."
  };

  const first = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: payload
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.created, true);
  assert.equal(first.body.activity.quantity, 25);
  assert.equal(first.body.activity.farmName, "River Side Farm");

  const retry = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: { ...payload, description: "Retried record" }
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.created, false);
  assert.equal(retry.body.activity.id, first.body.activity.id);
  assert.equal(retry.body.activity.description, payload.description);

  const list = await api(server.baseUrl, "/api/activities", { token });
  assert.equal(list.body.pagination.total, 1);
});

test("activity history filters by farm, type and date range in reverse order", async () => {
  const riceFarm = await createFarm({ farmName: "Rice Farm", farmType: "crop_farming" });
  const poultryFarm = await createFarm({
    farmName: "Poultry Farm",
    farmType: "poultry",
    mainCropOrLivestock: "Layers"
  });

  await createActivity({
    farmId: riceFarm.body.farm.id,
    activityType: "planting",
    activityDate: "2026-10-01",
    description: "Planted early"
  });
  await createActivity({
    farmId: riceFarm.body.farm.id,
    activityType: "weeding",
    activityDate: "2026-10-20",
    description: "Weeded the field"
  });
  await createActivity({
    farmId: poultryFarm.body.farm.id,
    activityType: "feeding",
    activityDate: "2026-11-05",
    description: "Fed the layers"
  });

  const all = await api(server.baseUrl, "/api/activities", { token });
  assert.equal(all.body.items.length, 3);
  assert.deepEqual(
    all.body.items.map((item) => item.activityDate),
    ["2026-11-05", "2026-10-20", "2026-10-01"]
  );
  assert.equal(all.body.items[0].farmName, "Poultry Farm");

  const byFarm = await api(server.baseUrl, `/api/activities?farmId=${riceFarm.body.farm.id}`, {
    token
  });
  assert.equal(byFarm.body.items.length, 2);

  const byType = await api(server.baseUrl, "/api/activities?type=weeding", { token });
  assert.equal(byType.body.items.length, 1);
  assert.equal(byType.body.items[0].description, "Weeded the field");

  const byDate = await api(
    server.baseUrl,
    "/api/activities?from=2026-10-15&to=2026-10-31",
    { token }
  );
  assert.equal(byDate.body.items.length, 1);

  const pagination = await api(server.baseUrl, "/api/activities?page=1&pageSize=2", { token });
  assert.equal(pagination.body.items.length, 2);
  assert.equal(pagination.body.pagination.total, 3);
  assert.equal(pagination.body.pagination.pageSize, 2);

  const badType = await api(server.baseUrl, "/api/activities?type=space_farming", { token });
  assert.equal(badType.status, 400);
});

test("activities can be edited and deleted softly", async () => {
  const activity = await createActivity();
  const activityId = activity.body.activity.id;

  const updated = await api(server.baseUrl, `/api/activities/${activityId}`, {
    method: "PATCH",
    token,
    body: { description: "Planted rice seedlings on the upper field.", quantity: 12.5, unit: "kg" }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.activity.description, "Planted rice seedlings on the upper field.");
  assert.equal(updated.body.activity.quantity, 12.5);

  const deleted = await api(server.baseUrl, `/api/activities/${activityId}`, {
    method: "DELETE",
    token
  });
  assert.equal(deleted.status, 200);

  const list = await api(server.baseUrl, "/api/activities", { token });
  assert.equal(list.body.pagination.total, 0);

  const detail = await api(server.baseUrl, `/api/activities/${activityId}`, { token });
  assert.equal(detail.status, 404);

  const again = await api(server.baseUrl, `/api/activities/${activityId}`, {
    method: "DELETE",
    token
  });
  assert.equal(again.status, 404);
});

test("activity validation rejects missing required fields", async () => {
  const farm = await createFarm();
  const farmId = farm.body.farm.id;

  const noDescription = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: {
      clientId: "validation-client-1",
      farmId,
      activityType: "planting",
      activityDate: "2026-11-01"
    }
  });
  assert.equal(noDescription.status, 400);
  assert.equal(noDescription.body.error.details.field, "description");

  const badDate = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: {
      clientId: "validation-client-2",
      farmId,
      activityType: "planting",
      activityDate: "01/11/2026",
      description: "Bad date"
    }
  });
  assert.equal(badDate.status, 400);

  const badQuantity = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: {
      clientId: "validation-client-3",
      farmId,
      activityType: "planting",
      activityDate: "2026-11-01",
      description: "Negative quantity",
      quantity: -5
    }
  });
  assert.equal(badQuantity.status, 400);

  const missingClientId = await api(server.baseUrl, "/api/activities", {
    method: "POST",
    token,
    body: {
      farmId,
      activityType: "planting",
      activityDate: "2026-11-01",
      description: "No client id"
    }
  });
  assert.equal(missingClientId.status, 400);
});
