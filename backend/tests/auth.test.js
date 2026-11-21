import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
  api,
  closeDatabase,
  createAdminRecord,
  createFarmerRecord,
  loginAs,
  resetDatabase,
  startServer
} from "./helpers.js";

let server;

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await server.close();
  await closeDatabase();
});

test("farmer can self-register and receives a session", async () => {
  const result = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Martha Nyema",
      phoneNumber: "077 555 1234",
      county: "Nimba",
      district: "Saclepea",
      community: "Zekepa",
      pin: "4321",
      confirmPin: "4321"
    }
  });
  assert.equal(result.status, 201);
  assert.ok(result.body.token);
  assert.equal(result.body.user.role, "farmer");
  assert.equal(result.body.user.phoneNumber, "+231775551234");
  assert.equal(result.body.user.county, "Nimba");

  const me = await api(server.baseUrl, "/api/auth/me", { token: result.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.fullName, "Martha Nyema");
});

test("registration rejects duplicate phone numbers and invalid input", async () => {
  const base = {
    fullName: "Joseph Kpadeh",
    phoneNumber: "0775552222",
    county: "Bong",
    district: "Gbarnga",
    community: "Gbarnga",
    pin: "1234",
    confirmPin: "1234"
  };
  const first = await api(server.baseUrl, "/api/auth/register", { method: "POST", body: base });
  assert.equal(first.status, 201);

  const duplicate = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...base, phoneNumber: "+231775552222" }
  });
  assert.equal(duplicate.status, 409);

  const badPhone = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...base, phoneNumber: "12345" }
  });
  assert.equal(badPhone.status, 400);
  assert.equal(badPhone.body.error.details.field, "phoneNumber");

  const pinMismatch = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...base, phoneNumber: "0775553333", confirmPin: "9999" }
  });
  assert.equal(pinMismatch.status, 400);

  const badCounty = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...base, phoneNumber: "0775554444", county: "Atlantis" }
  });
  assert.equal(badCounty.status, 400);

  const weakPin = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { ...base, phoneNumber: "0775555555", pin: "12", confirmPin: "12" }
  });
  assert.equal(weakPin.status, 400);
});

test("farmer logs in with phone number in any common format", async () => {
  const { pin } = await createFarmerRecord({ phoneNumber: "+231770002222" });

  for (const identifier of ["0770002222", "770002222", "+231 77 000 2222"]) {
    const result = await loginAs(server.baseUrl, identifier, pin);
    assert.equal(result.status, 200, identifier);
    assert.equal(result.body.user.role, "farmer");
  }
});

test("login errors stay generic and do not reveal account existence", async () => {
  await createFarmerRecord({ phoneNumber: "+231770003333" });

  const wrongPin = await loginAs(server.baseUrl, "0770003333", "000000");
  assert.equal(wrongPin.status, 401);
  assert.equal(wrongPin.body.error.code, "INVALID_CREDENTIALS");

  const unknownAccount = await loginAs(server.baseUrl, "0770004444", "123456");
  assert.equal(unknownAccount.status, 401);
  assert.deepEqual(unknownAccount.body.error, wrongPin.body.error);
});

test("unified login detects administrators by access code and by phone", async () => {
  const { pin, accessCode } = await createAdminRecord();

  const byCode = await loginAs(server.baseUrl, "mnd-testadmin", pin);
  assert.equal(byCode.status, 200);
  assert.equal(byCode.body.user.role, "admin");
  assert.equal(byCode.body.user.displayName, "Test Admin");
  assert.equal(byCode.body.user.accessCode, undefined);
  assert.equal(accessCode, "MND-TESTADMIN");

  const byPhone = await loginAs(server.baseUrl, "0770009999", pin);
  assert.equal(byPhone.status, 200);
  assert.equal(byPhone.body.user.role, "admin");
});

test("inactive accounts cannot sign in even with the correct PIN", async () => {
  const { pin } = await createFarmerRecord({
    phoneNumber: "+231770004444",
    status: "inactive"
  });
  const farmer = await loginAs(server.baseUrl, "0770004444", pin);
  assert.equal(farmer.status, 403);
  assert.equal(farmer.body.error.code, "ACCOUNT_INACTIVE");

  const admin = await createAdminRecord({ accessCode: "MND-BLOCKED", status: "inactive" });
  const adminLogin = await loginAs(server.baseUrl, "MND-BLOCKED", admin.pin);
  assert.equal(adminLogin.status, 403);
  assert.equal(adminLogin.body.error.code, "ACCOUNT_INACTIVE");
});

test("logout revokes the session token", async () => {
  const registered = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Korto Sumo",
      phoneNumber: "0770005555",
      county: "Lofa",
      district: "Voinjama",
      community: "Voinjama",
      pin: "5555",
      confirmPin: "5555"
    }
  });
  const token = registered.body.token;

  const logout = await api(server.baseUrl, "/api/auth/logout", { method: "POST", token });
  assert.equal(logout.status, 200);

  const me = await api(server.baseUrl, "/api/auth/me", { token });
  assert.equal(me.status, 401);

  const missing = await api(server.baseUrl, "/api/auth/me");
  assert.equal(missing.status, 401);
});

test("PIN change requires the current PIN and revokes other devices", async () => {
  const registered = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Fatu Kamara",
      phoneNumber: "0770006666",
      county: "Margibi",
      district: "Kakata",
      community: "Kakata",
      pin: "1111",
      confirmPin: "1111"
    }
  });
  const firstToken = registered.body.token;

  const second = await loginAs(server.baseUrl, "0770006666", "1111");
  assert.equal(second.status, 200);
  const secondToken = second.body.token;

  const wrong = await api(server.baseUrl, "/api/auth/pin", {
    method: "POST",
    token: firstToken,
    body: { currentPin: "9999", newPin: "2222", confirmPin: "2222" }
  });
  assert.equal(wrong.status, 400);

  const changed = await api(server.baseUrl, "/api/auth/pin", {
    method: "POST",
    token: firstToken,
    body: { currentPin: "1111", newPin: "2222", confirmPin: "2222" }
  });
  assert.equal(changed.status, 200);

  const revoked = await api(server.baseUrl, "/api/auth/me", { token: secondToken });
  assert.equal(revoked.status, 401);

  const stillValid = await api(server.baseUrl, "/api/auth/me", { token: firstToken });
  assert.equal(stillValid.status, 200);

  const oldPin = await loginAs(server.baseUrl, "0770006666", "1111");
  assert.equal(oldPin.status, 401);
  const newPin = await loginAs(server.baseUrl, "0770006666", "2222");
  assert.equal(newPin.status, 200);
});
