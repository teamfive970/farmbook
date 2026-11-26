import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, resetDatabase, startServer } from "./helpers.js";
import { resetVoiceCalls, spoken } from "../src/services/voiceService.js";
import { setWeatherFetcher } from "../src/services/weatherService.js";

let server;

async function call(fields, key = "voice-key") {
  const response = await fetch(`${server.baseUrl}/api/voice${key ? `?key=${key}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields)
  });
  return { status: response.status, text: await response.text() };
}

before(async () => {
  process.env.VOICE_SECRET = "voice-key";
  setWeatherFetcher(async () => ({
    ok: true,
    json: async () => ({
      daily: {
        time: ["2026-11-25", "2026-11-26"],
        weather_code: [61, 1],
        temperature_2m_max: [29, 31],
        temperature_2m_min: [22, 22],
        precipitation_sum: [12, 0],
        precipitation_probability_max: [90, 10],
        wind_speed_10m_max: [10, 10]
      }
    })
  }));
  server = await startServer();
});
beforeEach(async () => {
  resetVoiceCalls();
  await resetDatabase();
});
after(async () => {
  setWeatherFetcher(null);
  delete process.env.VOICE_SECRET;
  await server.close();
  await closeDatabase();
});

test("voice is hidden without the key", async () => {
  assert.equal((await call({ sessionId: "a" }, "")).status, 404);
  assert.equal((await call({ sessionId: "a" }, "nope")).status, 404);
});

test("screens become spoken words", () => {
  assert.equal(spoken("Weather for which county?\n1. Bomi\n2. Bong"), "Weather for which county? Press 1 for bomi. Press 2 for bong.");
  assert.equal(spoken("Rice L$3,200/bag, 29C. Tmrw: dry"), "Rice 3,200 Liberian dollars per bag, 29 degrees. Tomorrow: dry");
});

test("a new caller hears the menu, gets weather, and is sent to USSD to sign up", async () => {
  const start = await call({ sessionId: "s1", callerNumber: "+231775554001", isActive: "1" });
  assert.match(start.text, /<GetDigits timeout="20" numDigits="1" callbackUrl="http:\/\/127\.0\.0\.1:\d+\/api\/voice\?key=voice-key">/);
  assert.match(start.text, /Press 1 for how to make an account\. Press 2 for weather\. Press 3 for market prices\./);
  const county = await call({ sessionId: "s1", callerNumber: "+231775554001", isActive: "1", dtmfDigits: "2" });
  assert.match(county.text, /Weather for which county\? Press 1 for bomi/);
  const weather = await call({ sessionId: "s1", callerNumber: "+231775554001", isActive: "1", dtmfDigits: "2" });
  assert.match(weather.text, /Bong: Today rain, 29 degrees\. Tomorrow: dry, 31 degrees\..*Goodbye/);
  assert.equal(weather.text.includes("GetDigits"), false);

  await call({ sessionId: "s2", callerNumber: "+231775554001", isActive: "1" });
  const signup = await call({ sessionId: "s2", callerNumber: "+231775554001", isActive: "1", dtmfDigits: "1" });
  assert.match(signup.text, /dial the FarmBok USSD code/);
});

test("a farmer types the PIN with # and uses the menu", async () => {
  const reg = await api(server.baseUrl, "/api/auth/register", {
    method: "POST",
    body: { fullName: "Musu Kollie", phoneNumber: "0775554002", county: "Bong", district: "D", community: "C", pin: "1122", confirmPin: "1122" }
  });
  assert.equal(reg.status, 201);
  const fields = { sessionId: "s3", callerNumber: "+231775554002", isActive: "1" };
  const hello = await call(fields);
  assert.match(hello.text, /Hello Musu\. Type your secret PIN on the phone keys, then press the hash key\./);
  assert.match(hello.text, /finishOnKey="#"/);
  const menu = await call({ ...fields, dtmfDigits: "1122#" });
  assert.match(menu.text, /Press 1 for record farm work\./);
  const money = await call({ ...fields, dtmfDigits: "5" });
  assert.match(money.text, /No money records yet\. Thank you for calling FarmBok/);

  await call({ ...fields, sessionId: "s4" });
  const wrong = await call({ ...fields, sessionId: "s4", dtmfDigits: "9999#" });
  assert.match(wrong.text, /Wrong PIN/);

  await call({ ...fields, sessionId: "s5" });
  const silent = await call({ ...fields, sessionId: "s5", dtmfDigits: "" });
  assert.match(silent.text, /did not hear any keys/);
  assert.equal((await call({ ...fields, sessionId: "s5", isActive: "0" })).text, "");
});
