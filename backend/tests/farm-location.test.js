import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, resetDatabase, startServer } from "./helpers.js";

let server;
let seq = 0;
const uid = () => `client-${Date.now().toString(16)}-${(seq += 1)}-loc`;
const today = () => new Date().toISOString().slice(0, 10);

before(async () => {
  server = await startServer();
});
beforeEach(resetDatabase);
after(async () => {
  await server.close();
  await closeDatabase();
});

async function setup(location) {
  const reg = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Musu Kollie", phoneNumber: "0775551111", county: "Bong", district: "Gbarnga", community: "Town", pin: "1122", confirmPin: "1122" }
  });
  const token = reg.body.token;
  const farmRes = await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token,
    body: { clientId: uid(), farmName: "Swamp", county: "Bong", district: "Gbarnga", community: "Town", farmType: "crop_farming", crops: ["Rice"], location }
  });
  assert.equal(farmRes.status, 201, JSON.stringify(farmRes.body));
  const farm = farmRes.body.farm;
  const harvest = (
    await api(server.baseUrl, "/api/harvests", {
      method: "POST",
      token,
      body: { clientId: uid(), farmClientId: farm.clientId, crop: "Rice", harvestDate: today(), quantity: 10, unit: "bags" }
    })
  ).body.record;
  await api(server.baseUrl, `/api/harvests/${harvest.id}`, { method: "PATCH", token, body: { passportPublic: true } });
  return { token, farm, code: harvest.passportCode };
}

test("farm location is saved, but the passport shows it only when the farmer allows, rounded", async () => {
  const { token, farm, code } = await setup({ latitude: 6.998712, longitude: -9.472301, accuracy: 12.4 });
  assert.deepEqual(
    { lat: farm.location.latitude, lon: farm.location.longitude, acc: farm.location.accuracy, show: farm.showOnMap },
    { lat: 6.998712, lon: -9.472301, acc: 12, show: false }
  );
  let passport = await api(server.baseUrl, `/api/passport/${code}`);
  assert.equal(passport.body.passport.farm.location, null);
  assert.equal(JSON.stringify(passport.body).includes("6.998712"), false);

  const on = await api(server.baseUrl, `/api/farms/${farm.id}`, { method: "PATCH", token, body: { showOnMap: true } });
  assert.equal(on.status, 200);
  passport = await api(server.baseUrl, `/api/passport/${code}`);
  assert.deepEqual(passport.body.passport.farm.location, { latitude: 7, longitude: -9.47, approximate: true });

  const cleared = await api(server.baseUrl, `/api/farms/${farm.id}`, { method: "PATCH", token, body: { location: null } });
  assert.equal(cleared.body.location ?? cleared.body.farm?.location ?? null, null);
  passport = await api(server.baseUrl, `/api/passport/${code}`);
  assert.equal(passport.body.passport.farm.location, null);
});

test("a location outside Liberia or not a number is refused", async () => {
  const { token, farm } = await setup(undefined);
  assert.equal(farm.location, null);
  const ghana = await api(server.baseUrl, `/api/farms/${farm.id}`, { method: "PATCH", token, body: { location: { latitude: 5.6, longitude: -0.19 } } });
  assert.equal(ghana.status, 400);
  assert.equal(ghana.body.error.details.field, "location");
  const junk = await api(server.baseUrl, `/api/farms/${farm.id}`, { method: "PATCH", token, body: { location: { latitude: "x" } } });
  assert.equal(junk.status, 400);
  const flag = await api(server.baseUrl, `/api/farms/${farm.id}`, { method: "PATCH", token, body: { showOnMap: "yes" } });
  assert.equal(flag.status, 400);
});
