import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { api, closeDatabase, createAdminRecord, loginAs, query, resetDatabase, startServer } from "./helpers.js";
import { setSmsTransportForTests } from "../src/lib/sms.js";
import { ensureDemoAdmin } from "../src/lib/demoAccess.js";
import { waitForSmsJobs } from "../src/services/notificationService.js";

let server;

before(async () => {
  server = await startServer();
});
beforeEach(async () => {
  await resetDatabase();
  delete process.env.DEMO_ADMIN_ACCESS_CODE;
  delete process.env.DEMO_ADMIN_PIN;
});
afterEach(() => {
  delete process.env.DEMO_ADMIN_ACCESS_CODE;
  delete process.env.DEMO_ADMIN_PIN;
  setSmsTransportForTests(null);
});
after(async () => {
  await server.close();
  await closeDatabase();
});

function switchOn() {
  process.env.DEMO_ADMIN_ACCESS_CODE = "Minister-Demo";
  process.env.DEMO_ADMIN_PIN = "112233";
}

test("nothing is shown or created unless the demo login is switched on", async () => {
  const shown = await api(server.baseUrl, "/api/public/demo-access");
  assert.equal(shown.status, 200);
  assert.deepEqual(shown.body, { enabled: false });
  await ensureDemoAdmin();
  assert.equal((await query("SELECT count(*)::int AS n FROM admin_users")).rows[0].n, 0);
});

test("switched on: the home page gets the code and PIN, and they sign in (any letter case)", async () => {
  switchOn();
  const shown = await api(server.baseUrl, "/api/public/demo-access");
  assert.deepEqual(shown.body, {
    enabled: true,
    admin: { accessCode: "Minister-Demo", pin: "112233", loginPath: "/admin/login" }
  });
  await ensureDemoAdmin();
  await ensureDemoAdmin(); // a second start does not add a second admin
  assert.equal((await query("SELECT count(*)::int AS n FROM admin_users")).rows[0].n, 1);
  const login = await loginAs(server.baseUrl, "minister-demo", "112233");
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.role, "admin");
});

test("each start puts the shared login right again: PIN, active, not locked", async () => {
  switchOn();
  await ensureDemoAdmin();
  await query(
    "UPDATE admin_users SET pin_hash = 'x', status = 'inactive', failed_login_count = 9, locked_until = now() + interval '1 hour'"
  );
  assert.notEqual((await loginAs(server.baseUrl, "Minister-Demo", "112233")).status, 200);
  await ensureDemoAdmin();
  assert.equal((await loginAs(server.baseUrl, "Minister-Demo", "112233")).status, 200);
});

test("bad settings are ignored with a warning", async () => {
  process.env.DEMO_ADMIN_ACCESS_CODE = "ab";
  process.env.DEMO_ADMIN_PIN = "12";
  await ensureDemoAdmin();
  assert.deepEqual((await api(server.baseUrl, "/api/public/demo-access")).body, { enabled: false });
  assert.equal((await query("SELECT count(*)::int AS n FROM admin_users")).rows[0].n, 0);
});

test("the shared login cannot change its code or PIN, and its announcements never go by SMS", async () => {
  switchOn();
  await ensureDemoAdmin();
  const token = (await loginAs(server.baseUrl, "Minister-Demo", "112233")).body.token;

  const rotate = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token,
    body: { currentPin: "112233", newPin: "999999", confirmPin: "999999" }
  });
  assert.equal(rotate.status, 403);
  const pin = await api(server.baseUrl, "/api/auth/pin", {
    method: "POST",
    token,
    body: { currentPin: "112233", newPin: "999999", confirmPin: "999999" }
  });
  assert.equal(pin.status, 403);

  const texts = [];
  setSmsTransportForTests(async (to) => texts.push(to));
  const sent = await api(server.baseUrl, "/api/admin/announcements", {
    method: "POST",
    token,
    body: { title: "Tester message", body: "Only a test.", sendSms: true }
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.announcement.sms.status, "none");
  await waitForSmsJobs();
  assert.equal(texts.length, 0);

  // A real admin is not held back.
  const { accessCode, pin: realPin } = await createAdminRecord();
  const real = (await loginAs(server.baseUrl, accessCode, realPin)).body.token;
  const realRotate = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token: real,
    body: { currentPin: realPin, newPin: "975310", confirmPin: "975310" }
  });
  assert.equal(realRotate.status, 200, JSON.stringify(realRotate.body));
});

test("deleting the variables switches the tester login off; a new code retires the old one", async () => {
  switchOn();
  await ensureDemoAdmin();
  const token = (await loginAs(server.baseUrl, "Minister-Demo", "112233")).body.token;
  const { accessCode, pin } = await createAdminRecord();

  // New code: the old tester login stops, the new one works, real admins untouched.
  process.env.DEMO_ADMIN_ACCESS_CODE = "Judges-2026";
  await ensureDemoAdmin();
  assert.notEqual((await loginAs(server.baseUrl, "Minister-Demo", "112233")).status, 200);
  assert.equal((await api(server.baseUrl, "/api/admin/announcements", { token })).status, 401);
  assert.equal((await loginAs(server.baseUrl, "Judges-2026", "112233")).status, 200);

  delete process.env.DEMO_ADMIN_ACCESS_CODE;
  delete process.env.DEMO_ADMIN_PIN;
  await ensureDemoAdmin();
  assert.notEqual((await loginAs(server.baseUrl, "Judges-2026", "112233")).status, 200);
  assert.equal((await loginAs(server.baseUrl, accessCode, pin)).status, 200);
  assert.deepEqual((await api(server.baseUrl, "/api/public/demo-access")).body, { enabled: false });
});
