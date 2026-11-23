import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { api, closeDatabase, createAdminRecord, loginAs, query, resetDatabase, startServer } from "./helpers.js";
import { setSmsTransportForTests } from "../src/lib/sms.js";

let server;
let seq = 0;
const uid = () => `client-${Date.now().toString(16)}-${(seq += 1)}-${Math.random().toString(16).slice(2, 8)}`;
const post = (path, token, body) => api(server.baseUrl, path, { method: "POST", token, body });
const get = (path, token) => api(server.baseUrl, path, { token });
const today = () => new Date().toISOString().slice(0, 10);
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

let phone = 0;
async function farmerWithPassport({ name = "Musu Kollie", passportOn = true } = {}) {
  phone += 1;
  const number = `07755${String(phone).padStart(5, "0")}`;
  const reg = await post("/api/auth/register", null, {
    fullName: name,
    phoneNumber: number,
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    pin: "1122",
    confirmPin: "1122"
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const token = reg.body.token;
  const farm = (
    await post("/api/farms", token, {
      clientId: uid(),
      farmName: "Farm",
      county: "Bong",
      district: "Gbarnga",
      community: "Town",
      farmType: "crop_farming",
      crops: ["Rice"]
    })
  ).body.farm;
  const harvest = (
    await post("/api/harvests", token, {
      clientId: uid(),
      farmClientId: farm.clientId,
      crop: "Rice",
      harvestDate: today(),
      quantity: 20,
      unit: "bags"
    })
  ).body.record;
  if (passportOn) {
    const on = await api(server.baseUrl, `/api/harvests/${harvest.id}`, { method: "PATCH", token, body: { passportPublic: true } });
    assert.equal(on.status, 200, JSON.stringify(on.body));
  }
  return { token, id: reg.body.user.id, number, harvest, code: harvest.passportCode };
}

const buyer = { name: "Ma Kebbeh", phone: "0886 123 456", organization: "Red Light Market", quantityWanted: 5, message: "Do you have more?" };

before(async () => {
  server = await startServer();
});
beforeEach(async () => {
  await resetDatabase();
});
afterEach(() => setSmsTransportForTests(null));
after(async () => {
  await server.close();
  await closeDatabase();
});

test("a buyer contacts the farmer from the passport; the farmer is told, the buyer never sees the farmer's number", async () => {
  const farmer = await farmerWithPassport();
  const passport = await get(`/api/passport/${farmer.code}`);
  assert.equal(passport.body.passport.canContact, true);
  assert.equal(JSON.stringify(passport.body).includes(farmer.number.slice(1)), false);

  const sent = await post(`/api/passport/${farmer.code.toLowerCase()}/contact`, null, buyer);
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.match(sent.body.message, /farmer will see your request/);
  assert.equal(JSON.stringify(sent.body).includes(farmer.number.slice(1)), false);

  const inbox = (await get("/api/notifications", farmer.token)).body.notifications;
  const note = inbox.find((item) => item.topic === "buyer_request");
  assert.equal(note.title, "A buyer wants your Rice");
  assert.match(note.body, /Ma Kebbeh \(Red Light Market\) scanned your Harvest Passport and wants 5 bags/);
  assert.equal(note.link, "/app/requests");

  const list = await get("/api/buyer-requests", farmer.token);
  assert.equal(list.status, 200);
  assert.equal(list.body.newCount, 1);
  const request = list.body.requests[0];
  assert.deepEqual(request.buyer, {
    name: "Ma Kebbeh",
    phone: "+231886123456",
    phoneDisplay: "+231 886 123 456",
    organization: "Red Light Market"
  });
  assert.equal(request.quantityWanted, 5);
  assert.equal(request.message, "Do you have more?");
  assert.equal(request.harvestClientId, farmer.harvest.clientId);
  assert.equal(request.status, "new");
});

test("checks: real phone, a name, passport turned on; bots are quietly ignored", async () => {
  const farmer = await farmerWithPassport();
  const hidden = await farmerWithPassport({ passportOn: false });
  assert.equal((await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, phone: "12345" })).body.error.details.field, "phone");
  assert.equal((await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, name: "M" })).status, 400);
  assert.equal((await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, quantityWanted: -2 })).status, 400);
  assert.equal((await post(`/api/passport/${hidden.code}/contact`, null, buyer)).status, 404);
  assert.equal((await post("/api/passport/NOT-A-CODE/contact", null, buyer)).status, 400);

  const bot = await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, website: "http://spam" });
  assert.equal(bot.status, 201);
  // A buyer abroad can give an international number.
  const abroad = await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, phone: "+233 24 123 4567" });
  assert.equal(abroad.status, 201);
  const list = (await get("/api/buyer-requests", farmer.token)).body.requests;
  assert.deepEqual(list.map((item) => item.buyer.phone), ["+233241234567"]);
});

test("asking again within a day updates the same request", async () => {
  const farmer = await farmerWithPassport();
  await post(`/api/passport/${farmer.code}/contact`, null, buyer);
  const again = await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, phone: "+231886123456", message: "Still interested" });
  assert.equal(again.status, 201);
  assert.match(again.body.message, /already with the farmer/);
  const list = (await get("/api/buyer-requests", farmer.token)).body.requests;
  assert.equal(list.length, 1);
  assert.equal(list[0].message, "Still interested");
  const notes = (await get("/api/notifications", farmer.token)).body.notifications.filter((n) => n.topic === "buyer_request");
  assert.equal(notes.length, 1);
});

test("share my number texts the buyer; decline tells nobody; only the farmer can answer", async () => {
  const texts = [];
  setSmsTransportForTests(async (to, message) => texts.push({ to, message }));
  const farmer = await farmerWithPassport();
  const other = await farmerWithPassport({ name: "Other Farmer" });
  await post(`/api/passport/${farmer.code}/contact`, null, buyer);
  await post(`/api/passport/${farmer.code}/contact`, null, { ...buyer, name: "Second Buyer", phone: "0777 000 111" });
  await flush();
  // The farmer allows SMS by default, so they got a text for each request.
  assert.equal(texts.filter((t) => t.to === `+231${farmer.number.slice(1)}`).length, 2);
  assert.match(texts[0].message, /wants to buy your Rice/);

  const [second, first] = (await get("/api/buyer-requests", farmer.token)).body.requests;
  assert.equal((await post(`/api/buyer-requests/${first.id}/share`, other.token)).status, 404);
  const admin = await createAdminRecord();
  const adminToken = (await loginAs(server.baseUrl, admin.accessCode, admin.pin)).body.token;
  assert.equal((await get("/api/buyer-requests", adminToken)).status, 403);

  texts.length = 0;
  const shared = await post(`/api/buyer-requests/${first.id}/share`, farmer.token);
  assert.equal(shared.status, 200);
  assert.equal(shared.body.smsSent, true);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].to, "+231886123456");
  assert.match(texts[0].message, /Musu, the farmer for Rice/);
  assert.match(texts[0].message, new RegExp(`Call or text: \\+231 ${farmer.number.slice(1, 4)}`));
  assert.equal(texts[0].message.includes("Kollie"), false);

  texts.length = 0;
  assert.equal((await post(`/api/buyer-requests/${second.id}/decline`, farmer.token)).body.status, "declined");
  assert.equal(texts.length, 0);
  const after = (await get("/api/buyer-requests", farmer.token)).body;
  assert.equal(after.newCount, 0);
  assert.deepEqual(after.requests.map((r) => r.status).sort(), ["declined", "shared"]);
});

test("no SMS when the farmer turned SMS off, or when SMS is not set up", async () => {
  const farmer = await farmerWithPassport();
  await api(server.baseUrl, "/api/notifications/settings", { method: "PATCH", token: farmer.token, body: { sms: false } });
  const texts = [];
  setSmsTransportForTests(async (to) => texts.push(to));
  await post(`/api/passport/${farmer.code}/contact`, null, buyer);
  await flush();
  assert.equal(texts.length, 0);

  setSmsTransportForTests(null);
  const request = (await get("/api/buyer-requests", farmer.token)).body.requests[0];
  const shared = await post(`/api/buyer-requests/${request.id}/share`, farmer.token);
  assert.equal(shared.body.smsSent, false);
  assert.match(shared.body.message, /Call the buyer/);
  assert.equal((await post(`/api/buyer-requests/${request.id}/called`, farmer.token)).body.status, "shared");
  assert.ok(await query("SELECT 1"));
});
