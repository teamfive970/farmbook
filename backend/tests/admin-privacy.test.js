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

const farmer = {
  fullName: "Martha Kpadeh",
  phoneNumber: "0775550001",
  county: "Nimba",
  district: "Sanniquellie",
  community: "Sanniquellie",
  pin: "9090",
  confirmPin: "9090"
};

async function registerFarmer(overrides = {}) {
  const result = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...farmer, ...overrides }
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
  const { pin } = await createAdminRecord({
    displayName: "Privacy Admin",
    accessCode: "MND-PRIVACY-TEST"
  });
  const login = await loginAs(server.baseUrl, "MND-PRIVACY-TEST", pin);
  assert.equal(login.status, 200);
  adminToken = login.body.token;
});

after(async () => {
  delete process.env.MAX_EXPORT_ROWS;
  await server.close();
  await closeDatabase();
});

test("phone numbers stay masked until a PIN and a reason are given", async () => {
  const user = await registerFarmer();
  const list = await api(server.baseUrl, "/api/admin/farmers", { token: adminToken });
  assert.equal(list.status, 200);
  const row = list.body.items.find((item) => item.id === user.user.id);
  assert.equal(row.phoneNumber, "+231 ••• ••• 001");
  assert.ok(!JSON.stringify(list.body).includes("+231775550001"));

  const detail = await api(
    server.baseUrl,
    `/api/admin/farmers/${user.user.id}?reason=${encodeURIComponent("Checking a duplicate account")}`,
    { token: adminToken }
  );
  assert.equal(detail.status, 200);
  assert.equal(detail.body.farmer.phoneNumber, "+231 ••• ••• 001");
  assert.ok(!JSON.stringify(detail.body).includes("+231775550001"));

  const noReason = await api(server.baseUrl, `/api/admin/farmers/${user.user.id}/reveal-phone`, {
    method: "POST",
    token: adminToken,
    body: { currentPin: "246810" }
  });
  assert.equal(noReason.status, 400);
  assert.equal(noReason.body.error.details.field, "reason");

  const noPin = await api(server.baseUrl, `/api/admin/farmers/${user.user.id}/reveal-phone`, {
    method: "POST",
    token: adminToken,
    body: { reason: "Confirming the farmer's number" }
  });
  assert.equal(noPin.status, 400);
  assert.equal(noPin.body.error.details.field, "currentPin");

  const wrongPin = await api(server.baseUrl, `/api/admin/farmers/${user.user.id}/reveal-phone`, {
    method: "POST",
    token: adminToken,
    body: { currentPin: "000000", reason: "Confirming the farmer's number" }
  });
  assert.equal(wrongPin.status, 400);

  const revealed = await api(server.baseUrl, `/api/admin/farmers/${user.user.id}/reveal-phone`, {
    method: "POST",
    token: adminToken,
    body: { currentPin: "246810", reason: "Confirming the farmer's number" }
  });
  assert.equal(revealed.status, 200);
  assert.equal(revealed.body.phoneNumber, "+231775550001");

  const { rows } = await query(
    "SELECT reason, metadata, ip_address FROM audit_logs WHERE action = 'farmer.phone_revealed'"
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, "Confirming the farmer's number");
  assert.equal(rows[0].metadata.phone, "+231 ••• ••• 001");
  assert.ok(rows[0].ip_address);
});

test("the audit log is append-only and readable by admins only", async () => {
  const user = await registerFarmer();
  await api(server.baseUrl, "/api/admin/farmers", { token: adminToken });

  const viewer = await api(server.baseUrl, "/api/admin/audit", { token: adminToken });
  assert.equal(viewer.status, 200);
  assert.ok(viewer.body.pagination.total >= 2);
  assert.equal(viewer.body.items[0].action, "audit.viewed", "the viewer records its own use");
  assert.ok(viewer.body.items.some((item) => item.action === "farmer.list_viewed"));
  assert.ok(viewer.body.items.every((item) => item.id));

  const filtered = await api(server.baseUrl, "/api/admin/audit?action=audit.viewed", {
    token: adminToken
  });
  assert.ok(filtered.body.items.every((item) => item.action === "audit.viewed"));

  const farmerToken = user.token;
  const denied = await api(server.baseUrl, "/api/admin/audit", { token: farmerToken });
  assert.equal(denied.status, 403);
  const anonymous = await api(server.baseUrl, "/api/admin/audit");
  assert.equal(anonymous.status, 401);

  await assert.rejects(() => query("UPDATE audit_logs SET reason = 'changed'"), /append-only/);
  await assert.rejects(() => query("DELETE FROM audit_logs"), /append-only/);
});

test("a stale admin session is locked out", async () => {
  await query("UPDATE sessions SET last_used_at = now() - interval '2 hours' WHERE admin_user_id IS NOT NULL");

  const stale = await api(server.baseUrl, "/api/admin/dashboard", { token: adminToken });
  assert.equal(stale.status, 401);

  const { rows } = await query(
    "SELECT revoked_at FROM sessions WHERE admin_user_id IS NOT NULL AND revoked_at IS NOT NULL"
  );
  assert.equal(rows.length, 1);
});

test("exports are capped and need a purpose", async () => {
  await registerFarmer();
  await registerFarmer({ phoneNumber: "0775550002", fullName: "Second Farmer" });

  process.env.MAX_EXPORT_ROWS = "1";
  try {
    const response = await fetch(
      `${server.baseUrl}/api/admin/exports/farmers?purpose=${encodeURIComponent("Cap check")}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-export-rows"), "1");
    assert.equal(response.headers.get("x-export-truncated"), "yes");
    const lines = (await response.text()).replace(/^﻿/, "").trim().split("\r\n");
    assert.equal(lines.length, 2, "header plus one capped row");
  } finally {
    delete process.env.MAX_EXPORT_ROWS;
  }
});
