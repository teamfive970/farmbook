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
import { setSmsTransportForTests } from "../src/lib/sms.js";
import { smsText, waitForSmsJobs } from "../src/services/notificationService.js";

let server;
let seq = 0;
const uid = () => `client-${Date.now().toString(16)}-${(seq += 1)}-${Math.random().toString(16).slice(2, 8)}`;
const post = (path, token, body) => api(server.baseUrl, path, { method: "POST", token, body });
const patch = (path, token, body) => api(server.baseUrl, path, { method: "PATCH", token, body });
const get = (path, token) => api(server.baseUrl, path, { token });

// A day relative to today, as YYYY-MM-DD (the server uses its own CURRENT_DATE).
function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

let phone = 0;
async function newFarmer({ county = "Bong", name = "Inbox Farmer" } = {}) {
  phone += 1;
  const result = await post("/api/auth/register", null, {
    fullName: name,
    phoneNumber: `07766${String(phone).padStart(5, "0")}`,
    county,
    district: "Town",
    community: "Town",
    pin: "1122",
    confirmPin: "1122"
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return { token: result.body.token, id: result.body.user.id };
}

async function newFarm(token) {
  const result = await post("/api/farms", token, {
    clientId: uid(),
    farmName: "Farm",
    county: "Bong",
    district: "Gbarnga",
    community: "Town",
    farmType: "crop_farming",
    crops: ["Rice", "Cassava"]
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.farm;
}

async function adminToken() {
  const { accessCode, pin } = await createAdminRecord();
  const login = await loginAs(server.baseUrl, accessCode, pin);
  assert.equal(login.status, 200);
  return login.body.token;
}

const topics = (inbox) => inbox.body.notifications.map((item) => item.topic).sort();

before(async () => {
  server = await startServer();
});
beforeEach(async () => {
  await resetDatabase();
});
after(async () => {
  setSmsTransportForTests(null);
  await server.close();
  await closeDatabase();
});

test("a new farmer's inbox has a welcome message, and asking again adds nothing", async () => {
  const { token } = await newFarmer();
  const first = await get("/api/notifications", token);
  assert.equal(first.status, 200);
  assert.deepEqual(topics(first), ["welcome"]);
  assert.equal(first.body.unreadCount, 1);
  assert.equal(first.body.settings.sms, true);

  const again = await get("/api/notifications", token);
  assert.equal(again.body.notifications.length, 1);
  assert.equal((await get("/api/notifications/unread-count", token)).body.unreadCount, 1);
});

test("inbox is for farmers only and each farmer sees only their own", async () => {
  const one = await newFarmer();
  const two = await newFarmer();
  const admin = await adminToken();
  assert.equal((await get("/api/notifications", null)).status, 401);
  assert.equal((await get("/api/notifications", admin)).status, 403);

  const mine = (await get("/api/notifications", one.token)).body.notifications[0];
  await get("/api/notifications", two.token);
  // Farmer two cannot mark farmer one's message as read.
  assert.equal((await post(`/api/notifications/${mine.id}/read`, two.token)).status, 404);
  assert.equal((await post(`/api/notifications/${mine.id}/read`, one.token)).body.unreadCount, 0);
  assert.equal((await post("/api/notifications/not-a-uuid/read", one.token)).status, 400);
});

test("reminders: no work lately, money owed, harvest ready to share; each goes away once done", async () => {
  const { token, id } = await newFarmer();
  const farm = await newFarm(token);

  // A farm with no work for weeks gets a 'record your work' reminder.
  await query("UPDATE farmers SET created_at = now() - interval '10 days' WHERE id = $1", [id]);
  let inbox = await get("/api/notifications", token);
  assert.deepEqual(topics(inbox), ["no_work", "welcome"]);
  assert.equal(inbox.body.notifications.find((n) => n.topic === "no_work").link, "/app/record");

  // A harvest checked grade A and a sale not paid for 10 days.
  const harvest = (
    await post("/api/harvests", token, {
      clientId: uid(),
      farmClientId: farm.clientId,
      crop: "Rice",
      harvestDate: daysAgo(12),
      quantity: 10,
      unit: "bags"
    })
  ).body.record;
  await post("/api/inspections", token, {
    clientId: uid(),
    harvestClientId: harvest.clientId,
    inspectionDate: daysAgo(11),
    grade: "A"
  });
  const buyer = (await post("/api/buyers", token, { clientId: uid(), name: "Ma Kebbeh", buyerType: "market_woman" })).body
    .record;
  const sale = (
    await post("/api/sales", token, {
      clientId: uid(),
      harvestClientId: harvest.clientId,
      buyerClientId: buyer.clientId,
      saleDate: daysAgo(10),
      quantity: 2,
      unitPrice: 2500,
      currency: "LRD"
    })
  ).body.record;
  await post("/api/payments", token, { clientId: uid(), saleClientId: sale.clientId, amount: 1000, paidDate: daysAgo(9) });

  inbox = await get("/api/notifications", token);
  // The farm now has records 9–12 days old: still more than 3 days, so the
  // work reminder is replaced by one for the new last record.
  assert.deepEqual(topics(inbox), ["money_owed", "no_work", "passport", "welcome"]);
  const owed = inbox.body.notifications.find((n) => n.topic === "money_owed");
  assert.equal(owed.title, "L$4,000 still owed for Rice");
  assert.match(owed.body, /Ma Kebbeh still owes you L\$4,000/);
  assert.equal(owed.link, `/app/money/sales/${sale.clientId}`);
  const passport = inbox.body.notifications.find((n) => n.topic === "passport");
  assert.equal(passport.title, "Grade A Rice: share it with buyers");
  assert.equal(passport.link, `/app/harvests/${harvest.clientId}`);
  assert.equal(inbox.body.notifications.filter((n) => n.topic === "no_work").length, 1);

  // Paid in full, passport on, work recorded today: the unread reminders go.
  await post("/api/payments", token, { clientId: uid(), saleClientId: sale.clientId, amount: 4000, paidDate: daysAgo(0) });
  await patch(`/api/harvests/${harvest.id}`, token, { passportPublic: true });
  const work = await post("/api/activities", token, {
    clientId: uid(),
    farmId: farm.id,
    activityType: "weeding",
    activityDate: daysAgo(0),
    description: "Weeding"
  });
  assert.equal(work.status, 201, JSON.stringify(work.body));
  inbox = await get("/api/notifications", token);
  assert.deepEqual(topics(inbox), ["welcome"]);
});

test("a read reminder stays as history; a group join leaves a message", async () => {
  const { token, id } = await newFarmer();
  await newFarm(token);
  await query("UPDATE farmers SET created_at = now() - interval '10 days' WHERE id = $1", [id]);
  const reminder = (await get("/api/notifications", token)).body.notifications.find((n) => n.topic === "no_work");
  await post(`/api/notifications/${reminder.id}/read`, token);

  const admin = await adminToken();
  const coop = (await post("/api/admin/cooperatives", admin, { name: "Gbarnga Rice Group", county: "Bong", district: "Gbarnga" }))
    .body.cooperative;
  const joined = await post("/api/cooperatives/join", token, { joinCode: coop.joinCode, consent: true });
  assert.equal(joined.status, 200, JSON.stringify(joined.body));

  const inbox = await get("/api/notifications", token);
  assert.deepEqual(topics(inbox), ["group_joined", "no_work", "welcome"]);
  assert.ok(inbox.body.notifications.find((n) => n.topic === "no_work").readAt);
  assert.equal(inbox.body.notifications.find((n) => n.topic === "group_joined").link, `/app/group/${coop.id}`);

  assert.equal((await post("/api/notifications/read-all", token)).body.unreadCount, 0);
  assert.equal((await get("/api/notifications/unread-count", token)).body.unreadCount, 0);
});

test("admin announcements reach all, one county or one group; inactive farmers are left out", async () => {
  const admin = await adminToken();
  const bong = await newFarmer({ county: "Bong" });
  const nimba = await newFarmer({ county: "Nimba" });
  const away = await newFarmer({ county: "Bong" });
  await query("UPDATE farmers SET status = 'inactive' WHERE id = $1", [away.id]);

  // Farmers cannot send.
  assert.equal((await post("/api/admin/announcements", bong.token, { title: "Hi", body: "x" })).status, 403);
  // Checks on the message and the audience.
  assert.equal((await post("/api/admin/announcements", admin, { title: "Hi", body: "Too short title" })).status, 400);
  assert.equal(
    (await post("/api/admin/announcements", admin, { title: "Seeds", body: "Free seeds", audience: { type: "county", value: "Atlantis" } }))
      .status,
    400
  );

  const preview = await get("/api/admin/announcements/audience?type=county&value=Bong", admin);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.farmers, 1);
  assert.equal(preview.body.audience.label, "Bong County");

  const all = await post("/api/admin/announcements", admin, {
    title: "Rain coming",
    body: "Heavy rain expected this week. Keep harvested rice dry.",
    audience: { type: "all" }
  });
  assert.equal(all.status, 201, JSON.stringify(all.body));
  assert.equal(all.body.announcement.recipients, 2);
  assert.equal(all.body.announcement.sms.status, "none");

  const county = await post("/api/admin/announcements", admin, {
    title: "Seed fair in Gbarnga",
    body: "Bring your farmer card on Saturday.",
    audience: { type: "county", value: "Bong" }
  });
  assert.equal(county.body.announcement.recipients, 1);

  const bongInbox = (await get("/api/notifications", bong.token)).body.notifications;
  const nimbaInbox = (await get("/api/notifications", nimba.token)).body.notifications;
  assert.deepEqual(bongInbox.filter((n) => n.kind === "announcement").map((n) => n.title).sort(), [
    "Rain coming",
    "Seed fair in Gbarnga"
  ]);
  assert.deepEqual(nimbaInbox.filter((n) => n.kind === "announcement").map((n) => n.title), ["Rain coming"]);

  // Read counts come back to the admin; the send is in the audit log.
  const rain = bongInbox.find((n) => n.title === "Rain coming");
  await post(`/api/notifications/${rain.id}/read`, bong.token);
  const list = (await get("/api/admin/announcements", admin)).body;
  const listed = list.announcements.find((a) => a.title === "Rain coming");
  assert.equal(listed.readCount, 1);
  assert.equal(listed.recipients, 2);
  assert.equal(listed.sentBy, "Test Admin");
  const audit = await query("SELECT * FROM audit_logs WHERE action = 'announcement_sent'");
  assert.equal(audit.rows.length, 2);
});

test("a group announcement reaches its active members only", async () => {
  const admin = await adminToken();
  const member = await newFarmer();
  const leaver = await newFarmer();
  await newFarmer();
  const coop = (await post("/api/admin/cooperatives", admin, { name: "Lofa Cassava Union", county: "Lofa", district: "Voinjama" }))
    .body.cooperative;
  await post("/api/cooperatives/join", member.token, { joinCode: coop.joinCode, consent: true });
  await post("/api/cooperatives/join", leaver.token, { joinCode: coop.joinCode, consent: true });
  await post(`/api/cooperatives/${coop.id}/leave`, leaver.token);

  const sent = await post("/api/admin/announcements", admin, {
    title: "Group meeting",
    body: "Meeting on Friday at the warehouse.",
    audience: { type: "cooperative", value: coop.id }
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.announcement.recipients, 1);
  assert.equal(sent.body.announcement.audience.label, "Lofa Cassava Union");
});

test("SMS goes to farmers who allow it; others get the app message only", async () => {
  const admin = await adminToken();
  const yes = await newFarmer();
  const no = await newFarmer();
  assert.equal((await patch("/api/notifications/settings", no.token, { sms: false })).body.settings.sms, false);
  assert.equal((await patch("/api/notifications/settings", no.token, { sms: "no" })).status, 400);

  // Without an SMS provider, the message still goes in the app and says so.
  const plain = await post("/api/admin/announcements", admin, {
    title: "Market day",
    body: "Prices for rice are up this week.",
    sendSms: true
  });
  assert.equal(plain.body.announcement.sms.status, "unavailable");
  assert.match(plain.body.message, /SMS is not set up/);

  const texts = [];
  setSmsTransportForTests(async (to, message) => {
    texts.push({ to, message });
  });
  try {
    const sent = await post("/api/admin/announcements", admin, {
      title: "Vaccination day",
      body: "Free chicken vaccines at the county office on Monday.",
      sendSms: true
    });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.announcement.sms.status, "sending");
    await waitForSmsJobs();
    assert.equal(texts.length, 1);
    assert.equal(texts[0].message, "FarmBok: Vaccination day. Free chicken vaccines at the county office on Monday.");
    const listed = (await get("/api/admin/announcements", admin)).body.announcements.find((a) => a.title === "Vaccination day");
    assert.deepEqual(listed.sms, { status: "done", sent: 1, failed: 0, skipped: 1 });
    assert.equal((await get("/api/notifications", no.token)).body.notifications.some((n) => n.title === "Vaccination day"), true);
    assert.ok(yes.id);
  } finally {
    setSmsTransportForTests(null);
  }
});

test("SMS text is short and plain", () => {
  assert.equal(smsText("Hello", "Line one.\n\nLine   two."), "FarmBok: Hello. Line one. Line two.");
  assert.equal(smsText("T", "x".repeat(400)).length, 320);
});
