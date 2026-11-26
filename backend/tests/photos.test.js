import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, query, resetDatabase, startServer } from "./helpers.js";
import { cleanImage } from "../src/lib/imageClean.js";

let server;
const JPEG = fs.readFileSync(new URL("./fixtures/photo-exif.jpg", import.meta.url));
const WEBP = fs.readFileSync(new URL("./fixtures/photo-exif.webp", import.meta.url));
const today = () => new Date().toISOString().slice(0, 10);

before(async () => {
  server = await startServer();
});
beforeEach(resetDatabase);
after(async () => {
  await server.close();
  await closeDatabase();
});

async function upload(token, params, body, type = "image/jpeg") {
  const response = await fetch(`${server.baseUrl}/api/photos?${new URLSearchParams(params)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": type },
    body
  });
  return { status: response.status, body: await response.json() };
}

async function setup(phone = "0775557001") {
  const reg = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Musu Kollie", phoneNumber: phone, county: "Bong", district: "D", community: "C", pin: "1122", confirmPin: "1122" }
  });
  const token = reg.body.token;
  const farm = (
    await api(server.baseUrl, "/api/farms", {
      method: "POST",
      token,
      body: { clientId: `farm-photo-${phone}`, farmName: "Swamp", county: "Bong", district: "D", community: "C", farmType: "crop_farming", crops: ["Rice"] }
    })
  ).body.farm;
  const harvest = (
    await api(server.baseUrl, "/api/harvests", {
      method: "POST",
      token,
      body: { clientId: `harvest-photo-${phone}`, farmClientId: farm.clientId, crop: "Rice", harvestDate: today(), quantity: 10, unit: "bags" }
    })
  ).body.record;
  return { token, harvest };
}

test("hidden data (EXIF) is removed from JPEG and WebP", () => {
  for (const file of [JPEG, WEBP]) {
    assert.ok(file.includes("SecretPhoneMaker"));
    const cleaned = cleanImage(file);
    assert.ok(cleaned, "accepted");
    assert.equal(cleaned.data.includes("SecretPhoneMaker"), false);
  }
  assert.equal(cleanImage(Buffer.from("<svg></svg>")), null);
  assert.equal(cleanImage(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), null);
});

test("harvest photos: upload, list, show on public passport, delete", async () => {
  const { token, harvest } = await setup();
  const first = await upload(token, { kind: "harvest", harvestId: harvest.id, clientId: "photo-1" }, JPEG);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const again = await upload(token, { kind: "harvest", harvestId: harvest.id, clientId: "photo-1" }, JPEG);
  assert.equal(again.body.photo.id, first.body.photo.id, "same photo sent twice is saved once");
  await upload(token, { kind: "harvest", harvestClientId: harvest.clientId }, WEBP, "image/webp");

  const list = await api(server.baseUrl, `/api/photos?harvestId=${harvest.id}`, { token });
  assert.equal(list.body.photos.length, 2);

  const own = await fetch(`${server.baseUrl}/api/photos/${first.body.photo.id}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(own.headers.get("content-type"), "image/jpeg");
  const bytes = Buffer.from(await own.arrayBuffer());
  assert.equal(bytes.includes("SecretPhoneMaker"), false);

  // Not on the passport until it is public.
  const photoUrl = `/api/passport/${harvest.passportCode}/photos/${first.body.photo.id}`;
  assert.equal((await fetch(`${server.baseUrl}${photoUrl}`)).status, 404);
  await api(server.baseUrl, `/api/harvests/${harvest.id}`, { method: "PATCH", token, body: { passportPublic: true } });
  const passport = await api(server.baseUrl, `/api/passport/${harvest.passportCode}`);
  assert.equal(passport.body.passport.photos.length, 2);
  assert.equal(passport.body.passport.photos[0].url, photoUrl);
  const pub = await fetch(`${server.baseUrl}${photoUrl}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.headers.get("content-type"), "image/jpeg");

  await api(server.baseUrl, `/api/photos/${first.body.photo.id}`, { method: "DELETE", token });
  assert.equal((await fetch(`${server.baseUrl}${photoUrl}`)).status, 404);
  assert.equal((await api(server.baseUrl, `/api/passport/${harvest.passportCode}`)).body.passport.photos.length, 1);
});

test("limits: 4 per harvest, photos only, not someone else's harvest, harvest not sent yet", async () => {
  const { token, harvest } = await setup();
  for (let i = 0; i < 4; i += 1) assert.equal((await upload(token, { kind: "harvest", harvestId: harvest.id }, JPEG)).status, 201);
  assert.equal((await upload(token, { kind: "harvest", harvestId: harvest.id }, JPEG)).status, 400);
  assert.equal((await upload(token, { kind: "harvest", harvestId: harvest.id }, Buffer.from("not a photo"), "image/jpeg")).status, 400);
  assert.equal((await upload(token, { kind: "harvest", harvestClientId: "harvest-not-sent-yet" }, JPEG)).status, 409);
  const other = await setup("0775557002");
  assert.equal((await upload(other.token, { kind: "harvest", harvestId: harvest.id }, JPEG)).status, 404);
  const big = Buffer.concat([JPEG.subarray(0, 4), Buffer.alloc(2 * 1024 * 1024)]);
  assert.equal((await upload(token, { kind: "profile" }, big)).status, 413);
  const photos = (await api(server.baseUrl, `/api/photos?harvestId=${harvest.id}`, { token })).body.photos;
  assert.equal((await fetch(`${server.baseUrl}/api/photos/${photos[0].id}`, { headers: { Authorization: `Bearer ${other.token}` } })).status, 404);
});

test("profile photo: set, replace, remove", async () => {
  const { token } = await setup();
  const one = await upload(token, { kind: "profile" }, JPEG);
  assert.equal(one.status, 201);
  assert.equal((await api(server.baseUrl, "/api/auth/me", { token })).body.user.photoId, one.body.photo.id);
  const two = await upload(token, { kind: "profile" }, WEBP, "image/webp");
  assert.equal((await api(server.baseUrl, "/api/auth/me", { token })).body.user.photoId, two.body.photo.id);
  assert.equal((await fetch(`${server.baseUrl}/api/photos/${one.body.photo.id}`, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
  await api(server.baseUrl, `/api/photos/${two.body.photo.id}`, { method: "DELETE", token });
  assert.equal((await api(server.baseUrl, "/api/auth/me", { token })).body.user.photoId, null);
  const { rows } = await query("SELECT count(*)::int AS n FROM photos WHERE deleted_at IS NULL");
  assert.equal(rows[0].n, 0);
});
