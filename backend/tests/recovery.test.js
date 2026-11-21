import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { setSmsTransportForTests } from "../src/lib/sms.js";
import {
  api,
  closeDatabase,
  createAdminRecord,
  createFarmerRecord,
  loginAs,
  query,
  resetDatabase,
  startServer
} from "./helpers.js";

let server;
let sentMessages;

before(async () => {
  server = await startServer();
});

beforeEach(async () => {
  await resetDatabase();
  sentMessages = [];
  setSmsTransportForTests(async (phone, message) => {
    sentMessages.push({ phone, message });
  });
});

after(async () => {
  setSmsTransportForTests(null);
  await server.close();
  await closeDatabase();
});

async function registerWithQuestion(overrides = {}) {
  return api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Korto Sumo",
      phoneNumber: "0775557001",
      county: "Lofa",
      district: "Voinjama",
      community: "Voinjama",
      pin: "1111",
      confirmPin: "1111",
      securityQuestion: "mother_first_name",
      securityAnswer: "  Grace ",
      ...overrides
    }
  });
}

test("security question recovery resets the PIN and revokes old sessions", async () => {
  const registered = await registerWithQuestion();
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.hasSecurityQuestion, true);
  const firstToken = registered.body.token;

  const second = await loginAs(server.baseUrl, "0775557001", "1111");
  const secondToken = second.body.token;

  const wrongAnswer = await api(server.baseUrl, "/api/auth/recovery/security-question", {
    method: "POST",
    body: {
      identifier: "0775557001",
      securityQuestion: "mother_first_name",
      securityAnswer: "Wrong",
      newPin: "2222",
      confirmPin: "2222"
    }
  });
  assert.equal(wrongAnswer.status, 401);
  assert.equal(wrongAnswer.body.error.code, "INVALID_CREDENTIALS");

  const wrongQuestion = await api(server.baseUrl, "/api/auth/recovery/security-question", {
    method: "POST",
    body: {
      identifier: "0775557001",
      securityQuestion: "father_first_name",
      securityAnswer: "Grace",
      newPin: "2222",
      confirmPin: "2222"
    }
  });
  assert.equal(wrongQuestion.status, 401);
  assert.deepEqual(wrongQuestion.body.error, wrongAnswer.body.error);

  const unknown = await api(server.baseUrl, "/api/auth/recovery/security-question", {
    method: "POST",
    body: {
      identifier: "0779999999",
      securityQuestion: "mother_first_name",
      securityAnswer: "Grace",
      newPin: "2222",
      confirmPin: "2222"
    }
  });
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.body.error, wrongAnswer.body.error);

  const recovered = await api(server.baseUrl, "/api/auth/recovery/security-question", {
    method: "POST",
    body: {
      identifier: "0775557001",
      securityQuestion: "mother_first_name",
      securityAnswer: "grace",
      newPin: "2222",
      confirmPin: "2222"
    }
  });
  assert.equal(recovered.status, 200);
  assert.ok(recovered.body.token);
  assert.equal(recovered.body.user.hasSecurityQuestion, true);

  assert.equal((await api(server.baseUrl, "/api/auth/me", { token: firstToken })).status, 401);
  assert.equal((await api(server.baseUrl, "/api/auth/me", { token: secondToken })).status, 401);
  assert.equal(
    (await api(server.baseUrl, "/api/auth/me", { token: recovered.body.token })).status,
    200
  );
  assert.equal((await loginAs(server.baseUrl, "0775557001", "1111")).status, 401);
  assert.equal((await loginAs(server.baseUrl, "0775557001", "2222")).status, 200);
});

test("a signed-in farmer can set up a recovery question", async () => {
  const { pin } = await createFarmerRecord({ phoneNumber: "+231775557002" });
  const login = await loginAs(server.baseUrl, "0775557002", pin);
  const token = login.body.token;
  assert.equal(login.body.user.hasSecurityQuestion, false);

  const wrongPin = await api(server.baseUrl, "/api/auth/recovery/setup", {
    method: "POST",
    token,
    body: {
      currentPin: "000000",
      securityQuestion: "home_town",
      securityAnswer: "Voinjama"
    }
  });
  assert.equal(wrongPin.status, 400);

  const saved = await api(server.baseUrl, "/api/auth/recovery/setup", {
    method: "POST",
    token,
    body: {
      currentPin: pin,
      securityQuestion: "home_town",
      securityAnswer: "Voinjama"
    }
  });
  assert.equal(saved.status, 200);
  const me = await api(server.baseUrl, "/api/auth/me", { token });
  assert.equal(me.body.user.hasSecurityQuestion, true);
});

test("SMS recovery sends a code and resets the PIN", async () => {
  const { pin } = await createFarmerRecord({ phoneNumber: "+231775557003" });

  const options = await api(server.baseUrl, "/api/auth/recovery/options");
  assert.equal(options.status, 200);
  assert.equal(options.body.smsAvailable, true);
  assert.ok(options.body.questions.some((item) => item.key === "mother_first_name"));

  const requested = await api(server.baseUrl, "/api/auth/recovery/sms/request", {
    method: "POST",
    body: { identifier: "0775557003" }
  });
  assert.equal(requested.status, 200);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].phone, "+231775557003");
  const code = sentMessages[0].message.match(/\b(\d{6})\b/)[1];

  const wrongCode = await api(server.baseUrl, "/api/auth/recovery/sms/verify", {
    method: "POST",
    body: { identifier: "0775557003", code: "000000", newPin: "3333", confirmPin: "3333" }
  });
  assert.equal(wrongCode.status, 401);

  const recovered = await api(server.baseUrl, "/api/auth/recovery/sms/verify", {
    method: "POST",
    body: { identifier: "0775557003", code, newPin: "3333", confirmPin: "3333" }
  });
  assert.equal(recovered.status, 200);
  assert.ok(recovered.body.token);
  assert.equal((await loginAs(server.baseUrl, "0775557003", pin)).status, 401);
  assert.equal((await loginAs(server.baseUrl, "0775557003", "3333")).status, 200);

  const reused = await api(server.baseUrl, "/api/auth/recovery/sms/verify", {
    method: "POST",
    body: { identifier: "0775557003", code, newPin: "4444", confirmPin: "4444" }
  });
  assert.equal(reused.status, 401);
});

test("SMS recovery reports when the provider is not configured", async () => {
  const previous = process.env.SMS_PROVIDER;
  setSmsTransportForTests(null);
  process.env.SMS_PROVIDER = "disabled";
  try {
    const options = await api(server.baseUrl, "/api/auth/recovery/options");
    assert.equal(options.body.smsAvailable, false);
    const requested = await api(server.baseUrl, "/api/auth/recovery/sms/request", {
      method: "POST",
      body: { identifier: "0775557004" }
    });
    assert.equal(requested.status, 503);
    assert.equal(requested.body.error.code, "SMS_UNAVAILABLE");
  } finally {
    process.env.SMS_PROVIDER = previous;
    setSmsTransportForTests(async (phone, message) => {
      sentMessages.push({ phone, message });
    });
  }
});

test("admins can reset a farmer PIN with a one-time temporary PIN", async () => {
  const admin = await createAdminRecord();
  const farmer = await createFarmerRecord({ phoneNumber: "+231775557005" });
  const adminLogin = await loginAs(server.baseUrl, admin.accessCode, admin.pin);
  const farmerLogin = await loginAs(server.baseUrl, "0775557005", farmer.pin);
  const farmerToken = farmerLogin.body.token;

  const wrongPin = await api(
    server.baseUrl,
    `/api/admin/farmers/${farmer.farmer.id}/reset-pin`,
    { method: "POST", token: adminLogin.body.token, body: { currentPin: "000000" } }
  );
  assert.equal(wrongPin.status, 400);

  const reset = await api(
    server.baseUrl,
    `/api/admin/farmers/${farmer.farmer.id}/reset-pin`,
    { method: "POST", token: adminLogin.body.token, body: { currentPin: admin.pin } }
  );
  assert.equal(reset.status, 200);
  assert.match(reset.body.tempPin, /^\d{6}$/);

  assert.equal((await api(server.baseUrl, "/api/auth/me", { token: farmerToken })).status, 401);
  assert.equal((await loginAs(server.baseUrl, "0775557005", farmer.pin)).status, 401);
  assert.equal((await loginAs(server.baseUrl, "0775557005", reset.body.tempPin)).status, 200);

  const audit = await query(
    "SELECT action FROM audit_logs WHERE target_id = $1 AND action = 'farmer.pin_reset'",
    [farmer.farmer.id]
  );
  assert.equal(audit.rowCount, 1);

  const asFarmer = await api(
    server.baseUrl,
    `/api/admin/farmers/${farmer.farmer.id}/reset-pin`,
    { method: "POST", token: farmerToken, body: { currentPin: admin.pin } }
  );
  assert.equal(asFarmer.status, 401);
});

test("admins can reveal their access code with the PIN and after rotation", async () => {
  const admin = await createAdminRecord();
  const login = await loginAs(server.baseUrl, admin.accessCode, admin.pin);
  const token = login.body.token;
  assert.equal(login.body.user.canRevealAccessCode, true);

  const wrongPin = await api(server.baseUrl, "/api/admin/me/access-code/reveal", {
    method: "POST",
    token,
    body: { currentPin: "000000" }
  });
  assert.equal(wrongPin.status, 400);

  const revealed = await api(server.baseUrl, "/api/admin/me/access-code/reveal", {
    method: "POST",
    token,
    body: { currentPin: admin.pin }
  });
  assert.equal(revealed.status, 200);
  assert.equal(revealed.body.accessCode, admin.accessCode);

  const rotated = await api(server.baseUrl, "/api/admin/me/credentials", {
    method: "PATCH",
    token,
    body: { currentPin: admin.pin, newAccessCode: "MND-NEWCODE" }
  });
  assert.equal(rotated.status, 200);
  assert.equal(rotated.body.admin.canRevealAccessCode, true);

  const revealedAgain = await api(server.baseUrl, "/api/admin/me/access-code/reveal", {
    method: "POST",
    token,
    body: { currentPin: admin.pin }
  });
  assert.equal(revealedAgain.status, 200);
  assert.equal(revealedAgain.body.accessCode, "MND-NEWCODE");

  const audit = await query(
    "SELECT action FROM audit_logs WHERE action = 'admin.access_code_revealed'"
  );
  assert.equal(audit.rowCount, 2);
});

test("recovery questions are limited per account and never unlock admins", async () => {
  const registered = await registerWithQuestion({ phoneNumber: "0775557101" });
  assert.equal(registered.status, 201);

  let last;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    last = await api(server.baseUrl, "/api/auth/recovery/security-question", {
      method: "POST",
      body: {
        identifier: "0775557101",
        securityQuestion: "mother_first_name",
        securityAnswer: `guess-${attempt}`,
        newPin: "2222",
        confirmPin: "2222"
      }
    });
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, "ACCOUNT_LOCKED");

  // The right answer must wait too.
  const right = await api(server.baseUrl, "/api/auth/recovery/security-question", {
    method: "POST",
    body: {
      identifier: "0775557101",
      securityQuestion: "mother_first_name",
      securityAnswer: "Grace",
      newPin: "2222",
      confirmPin: "2222"
    }
  });
  assert.equal(right.status, 429);

  const { admin } = await createAdminRecord({ accessCode: "MND-QUESTION" });
  // Give the admin a known answer ("grace", copied from the farmer above).
  await query(
    `UPDATE admin_users SET security_question = 'home_town',
       security_answer_hash = (SELECT security_answer_hash FROM farmers WHERE phone_number = $1)
     WHERE id = $2`,
    ["+231775557101", admin.id]
  );
  const adminAttempt = await api(server.baseUrl, "/api/auth/recovery/security-question", {
    method: "POST",
    body: {
      identifier: "MND-QUESTION",
      securityQuestion: "home_town",
      securityAnswer: "Grace",
      newPin: "135790",
      confirmPin: "135790"
    }
  });
  assert.equal(adminAttempt.status, 401);
});

test("a helper PIN reset unlocks a farmer who was waiting", async () => {
  const { pin: adminPin } = await createAdminRecord({ accessCode: "MND-HELPER", phoneNumber: null });
  const adminLogin = await loginAs(server.baseUrl, "MND-HELPER", adminPin);
  const { farmer } = await createFarmerRecord({ phoneNumber: "+231775557102" });
  await query(
    "UPDATE farmers SET failed_login_count = 7, locked_until = now() + interval '30 minutes' WHERE id = $1",
    [farmer.id]
  );

  const reset = await api(server.baseUrl, `/api/admin/farmers/${farmer.id}/reset-pin`, {
    method: "POST",
    token: adminLogin.body.token,
    body: { currentPin: adminPin }
  });
  assert.equal(reset.status, 200);
  const signIn = await loginAs(server.baseUrl, "0775557102", reset.body.tempPin);
  assert.equal(signIn.status, 200);
});

test("SMS codes cannot be guessed more than five times, even in parallel", async () => {
  await createFarmerRecord({ phoneNumber: "+231775557103" });
  const requested = await api(server.baseUrl, "/api/auth/recovery/sms/request", {
    method: "POST",
    body: { identifier: "0775557103" }
  });
  assert.equal(requested.status, 200);
  const code = /(\d{6})/.exec(sentMessages[0].message)[1];
  const wrong = code === "000000" ? "111111" : "000000";

  const guesses = await Promise.all(
    Array.from({ length: 10 }, () =>
      api(server.baseUrl, "/api/auth/recovery/sms/verify", {
        method: "POST",
        body: { identifier: "0775557103", code: wrong, newPin: "3333", confirmPin: "3333" }
      })
    )
  );
  assert.ok(guesses.every((result) => result.status === 401));
  const { rows } = await query("SELECT attempts FROM recovery_otps ORDER BY created_at DESC LIMIT 1");
  assert.ok(rows[0].attempts <= 5, `attempts were ${rows[0].attempts}`);

  // Even the right code is refused once the attempts are used up.
  const late = await api(server.baseUrl, "/api/auth/recovery/sms/verify", {
    method: "POST",
    body: { identifier: "0775557103", code, newPin: "3333", confirmPin: "3333" }
  });
  assert.equal(late.status, 401);
});
