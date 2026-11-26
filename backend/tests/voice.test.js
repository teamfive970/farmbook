import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, createAdminRecord, createFarmerRecord, loginAs, query, resetDatabase, startServer } from "./helpers.js";
import { spoken } from "../src/services/voiceService.js";
import { setWeatherFetcher } from "../src/services/weatherService.js";
import { ensureDemoFarmers } from "../src/services/demoFarmerService.js";

// The voice menu (IVR) through the browser simulator API and through the
// Africa's Talking voice adapter. Both run the same menu and sessions.

let server;
const PHONE = "+231775554001";

const http = async (method, path, body) => {
  const response = await fetch(`${server.baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};

// A simulated call: start(), then press("1"), press("1234#") ...
async function call({ mode = "development", phone = PHONE, demoFarmerId } = {}) {
  const started = await http("POST", "/api/voice/simulator/calls", { mode, phone, demoFarmerId });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const token = started.body.call.token;
  let step = 0;
  const said = (result) => result.prompts.map((prompt) => prompt.text).join(" ");
  return {
    first: started.body,
    token,
    said,
    async press(digits, { sameStep = false } = {}) {
      const result = await http("POST", `/api/voice/simulator/calls/${token}/keys`, { digits, step: sameStep ? step - 1 : step });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      step = result.body.call.step;
      return result.body;
    },
    hangUp: () => http("POST", `/api/voice/simulator/calls/${token}/end`),
    transcript: () => http("GET", `/api/voice/simulator/calls/${token}`)
  };
}

async function farmerWithFarm() {
  const { farmer } = await createFarmerRecord({ phoneNumber: PHONE, pin: "1234", fullName: "Musu Kollie" });
  const token = (await loginAs(server.baseUrl, PHONE, "1234")).body.token;
  await api(server.baseUrl, "/api/farms", {
    method: "POST",
    token,
    body: {
      clientId: "farm-client-0001",
      farmName: "Green Valley",
      county: "Bong",
      district: "Jorquelleh",
      community: "Gbarnga",
      farmType: "crop_farming",
      crops: ["Rice", "Cassava"]
    }
  });
  return { farmer, token };
}

before(async () => {
  setWeatherFetcher(async () => ({
    ok: true,
    json: async () => ({
      daily: {
        time: ["2026-11-25", "2026-11-26", "2026-11-27"],
        weather_code: [61, 1, 1],
        temperature_2m_max: [29, 31, 31],
        temperature_2m_min: [22, 22, 22],
        precipitation_sum: [12, 0, 0],
        precipitation_probability_max: [90, 10, 10],
        wind_speed_10m_max: [10, 10, 10]
      }
    })
  }));
  server = await startServer();
});
beforeEach(resetDatabase);
after(async () => {
  setWeatherFetcher(null);
  delete process.env.VOICE_SECRET;
  delete process.env.VOICE_PROVIDER;
  await server.close();
  await closeDatabase();
});

test("call start: welcome and language question, then PIN by keypad, then the main menu", async () => {
  await farmerWithFarm();
  const c = await call();
  assert.equal(c.first.call.status, "active");
  assert.equal(
    c.said(c.first),
    "Welcome to FarmBok, your farm record assistant. Please select your preferred language. Press 1 for English. Press 2 for Kpelle. Press 3 for Bassa."
  );
  assert.deepEqual(c.first.expect, { kind: "choice", numDigits: 1, finishOnKey: null, maxDigits: null });
  const pin = await c.press("1");
  assert.equal(c.said(pin), "Hello Musu. Please type your FarmBok PIN on the phone keys, then press the hash key.");
  assert.equal(pin.expect.finishOnKey, "#");
  const menu = await c.press("1234#");
  assert.equal(
    c.said(menu),
    "Welcome to FarmBok. Please select an option. Press 1 for farm activities. Press 2 to record a harvest. Press 3 to record a sale. Press 4 for your farm summary. Press 5 for weather. Press 6 for market prices. Press 7 for farm advice. Press 8 for help. Press 9 to end the call."
  );
  assert.equal(menu.call.authenticated, true);
  const bye = await c.press("9");
  assert.equal(bye.call.status, "completed");
  assert.equal(c.said(bye), "Thank you for calling FarmBok. Goodbye.");
});

test("language choice is saved on the farmer's profile; Kpelle and Bassa prompts are marked missing", async () => {
  const { farmer, token } = await farmerWithFarm();
  const c = await call();
  const pin = await c.press("2");
  assert.ok(pin.prompts.every((prompt) => prompt.missingTranslation && prompt.language === "en" && prompt.fallback === "english-tts"));
  await c.press("1234#");
  assert.equal((await query("SELECT preferred_language FROM farmers WHERE id = $1", [farmer.id])).rows[0].preferred_language, "kpelle");
  const me = await api(server.baseUrl, "/api/auth/me", { token });
  assert.equal(me.body.user.preferredLanguage, "kpelle");
  // And the app can set it too.
  const set = await api(server.baseUrl, "/api/auth/language", { method: "PUT", token, body: { language: "bassa" } });
  assert.equal(set.body.preferredLanguage, "bassa");
});

test("invalid keys are refused and the question is asked again", async () => {
  await farmerWithFarm();
  const c = await call();
  const again = await c.press("7");
  assert.equal(again.screen, "language");
  assert.match(c.said(again), /^That key is not on the menu\. Welcome to FarmBok/);
  await c.press("1");
  await c.press("1234#");
  const wrong = await c.press("0");
  assert.match(c.said(wrong), /^That key is not on the menu\. Welcome to FarmBok\. Please select an option/);
  const harvest = await c.press("2");
  assert.equal(harvest.screen, "harvest.crop");
});

test("wrong PIN ends the call and counts toward the lock; unknown callers are sent to USSD or the app", async () => {
  await farmerWithFarm();
  const c = await call();
  await c.press("1");
  const wrong = await c.press("9999#");
  assert.equal(wrong.call.status, "completed");
  assert.equal(c.said(wrong), "Wrong PIN. Please try again later.");
  assert.equal((await query("SELECT failed_login_count FROM farmers WHERE phone_number = $1", [PHONE])).rows[0].failed_login_count, 1);

  const stranger = await call({ phone: "+231775554999" });
  const reply = await stranger.press("1");
  assert.equal(reply.call.status, "completed");
  assert.match(stranger.said(reply), /no FarmBok account yet/);
});

test("activity, harvest and sale by voice are saved through the app's services", async () => {
  const { token } = await farmerWithFarm();
  const c = await call();
  await c.press("1");
  await c.press("1234#");

  // Farm activity: work, day, confirm.
  assert.match(c.said(await c.press("1")), /What work\? Press 1 for land preparation/);
  assert.match(c.said(await c.press("2")), /When\? Press 1 for today/);
  assert.match(c.said(await c.press("1")), /Save Planting on Green Valley, today\? Press 1 for save/);
  const saved = await c.press("1");
  assert.equal(c.said(saved), "Saved: Planting on Green Valley, today. Press 0 for the main menu. Press 9 to end the call.");

  // Back to the menu, record a harvest.
  await c.press("0");
  await c.press("2");
  await c.press("2"); // Cassava
  const quantity = await c.press("30#");
  assert.equal(quantity.screen, "harvest.unit");
  await c.press("1"); // bags
  await c.press("2"); // yesterday
  assert.match(c.said(await c.press("1")), /^Saved: 30 bags of Cassava/);

  // And a sale from it, paid, no cost.
  await c.press("0");
  assert.match(c.said(await c.press("3")), /Which harvest did you sell from\? Press 1 for cassava 30 bags \(yesterday\)/);
  await c.press("1");
  await c.press("10#");
  assert.match(c.said(await c.press("800#")), /Which money\?/);
  await c.press("1");
  await c.press("1");
  const review = await c.press("0#");
  assert.match(c.said(review), /Sell 10 bags Cassava at 800 Liberian dollars = 8,000 Liberian dollars\. Paid\./);
  assert.match(c.said(await c.press("1")), /^Saved: sale of 10 bags Cassava for 8,000 Liberian dollars/);

  const activities = await api(server.baseUrl, "/api/activities", { token });
  assert.deepEqual(activities.body.items.map((row) => [row.activityType, row.notes]), [["planting", "Recorded by IVR simulator"]]);
  const harvests = await api(server.baseUrl, "/api/harvests", { token });
  assert.deepEqual(harvests.body.items.map((row) => [row.crop, Number(row.quantity), row.unit]), [["Cassava", 30, "bags"]]);
  const report = await api(server.baseUrl, "/api/reports/summary", { token });
  assert.equal(report.body.money.received.LRD, 8000);

  // Summary read out on the same call.
  await c.press("0");
  const summary = await c.press("4");
  assert.match(
    c.said(summary),
    /Your farm summary\. Money in Liberian dollars: income 8,000 Liberian dollars, expenses 0 Liberian dollars, profit 8,000 Liberian dollars\. Harvests: Cassava 30 bags\. Recent sales: Cassava 10 bags 8,000 Liberian dollars \(today\)\./
  );
});

test("weather, market prices (with their source), advice and help are read out", async () => {
  await farmerWithFarm();
  const c = await call();
  await c.press("1");
  await c.press("1234#");
  const weather = await c.press("5");
  assert.match(c.said(weather), /^Bong today: rain, 12 millimetres rain, 22 degrees to 29 degrees\. Tomorrow: dry, up to 31 degrees\. Next day: dry, up to 31 degrees\./);
  await c.press("0");
  const prices = await c.press("6");
  assert.match(c.said(prices), /No market prices yet\. More farmers need to record sales\. No independently verified market prices are in FarmBok yet\./);
  await c.press("0");
  const advice = await c.press("7");
  assert.match(c.said(advice), /^Farm advice\. From the weather: .+ For advice on your farm, talk to your extension officer/);
  await c.press("0");
  assert.match(c.said(await c.press("8")), /never say it out loud/);
});

test("sessions: stored without the PIN, repeated presses aren't counted twice, timeout and hang-up end the call", async () => {
  await farmerWithFarm();
  const c = await call();
  await c.press("1");
  await c.press("1234#");
  const { rows } = await query("SELECT state, authenticated_at, steps FROM channel_sessions WHERE provider = 'simulator'");
  assert.deepEqual(rows[0].state.answers, ["1", "*"]);
  assert.ok(!JSON.stringify(rows[0].state).includes("1234"));
  assert.ok(rows[0].authenticated_at);

  const menu = await c.press("2");
  const repeat = await c.press("2", { sameStep: true }); // the same press arrives twice
  assert.equal(repeat.screen, menu.screen);
  assert.equal(repeat.call.step, menu.call.step);

  const transcript = await c.transcript();
  assert.deepEqual(transcript.body.transcript.map((row) => row.input), [null, "1", "[pin]", "2", null]);

  await query("UPDATE channel_sessions SET expires_at = now() - interval '1 second'");
  const late = await c.press("1");
  assert.equal(late.call.status, "completed");
  assert.equal(c.said(late), "Your session has ended. Please dial again.");

  const other = await call();
  assert.deepEqual((await other.hangUp()).body, { ended: true });
  assert.equal((await other.transcript()).body.status, "completed");
  assert.equal((await http("POST", "/api/voice/simulator/calls/not-a-real-token-at-all-xx/keys", { digits: "1" })).status, 404);
});

test("demo mode only calls demo farmers, and their records stay out of Ministry stats and prices", async () => {
  await ensureDemoFarmers();
  const info = await http("GET", "/api/voice/simulator");
  assert.equal(info.body.demoPin, "1234");
  assert.deepEqual(info.body.demoFarmers.map((farmer) => farmer.name), ["Musu Demo", "Kollie Demo"]);
  const musu = info.body.demoFarmers[0];

  const c = await call({ mode: "demo", demoFarmerId: musu.id });
  assert.equal(c.first.call.demo, true);
  await c.press("1");
  await c.press("1234#");
  await c.press("3"); // sale from the demo harvest
  await c.press("1");
  await c.press("2#");
  await c.press("3000#");
  await c.press("1");
  await c.press("1");
  await c.press("0#");
  assert.match(c.said(await c.press("1")), /^Saved: sale of 2 bags Rice/);
  const demoSales = await query("SELECT count(*)::int AS n FROM sales s JOIN farmers f ON f.id = s.farmer_id WHERE f.is_demo");
  assert.equal(demoSales.rows[0].n, 1);

  // Not in the Ministry dashboard, the farmer list or the analytics: only
  // the one real farmer counts.
  await farmerWithFarm();
  const { accessCode, pin } = await createAdminRecord();
  const adminToken = (await loginAs(server.baseUrl, accessCode, pin)).body.token;
  const dashboard = await api(server.baseUrl, "/api/admin/dashboard", { token: adminToken });
  assert.equal(dashboard.body.metrics.totalFarmers, 1);
  assert.equal(dashboard.body.metrics.totalSales, 0);
  assert.equal(dashboard.body.metrics.totalHarvests, 0);
  const farmers = await api(server.baseUrl, "/api/admin/farmers", { token: adminToken });
  assert.deepEqual(farmers.body.items.map((row) => row.fullName), ["Musu Kollie"]);
  const analytics = await api(server.baseUrl, "/api/admin/analytics", { token: adminToken });
  assert.equal(analytics.body.kpis.farmers, 1);
  assert.equal(analytics.body.kpis.sales, 0);
  assert.equal(analytics.body.kpis.money.received.LRD, 0);

  // Demo farmers can't be used in development mode, or by USSD.
  const refused = await http("POST", "/api/voice/simulator/calls", { mode: "development", phone: musu.phone });
  assert.equal(refused.status, 400);
  assert.equal((await http("POST", "/api/voice/simulator/calls", { mode: "demo", demoFarmerId: "nope" })).status, 400);
});

test("Africa's Talking: off unless configured; same menu as XML; recordings play when present", async () => {
  await farmerWithFarm();
  const post = async (fields, key = "voice-key") => {
    const response = await fetch(`${server.baseUrl}/api/voice${key ? `?key=${key}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields)
    });
    return { status: response.status, text: await response.text() };
  };
  assert.equal((await post({ sessionId: "ATVId_1" })).status, 404);
  process.env.VOICE_SECRET = "voice-key";
  process.env.VOICE_PROVIDER = "none";
  assert.equal((await post({ sessionId: "ATVId_1" })).status, 404);
  delete process.env.VOICE_PROVIDER; // VOICE_SECRET alone means Africa's Talking
  assert.equal((await post({ sessionId: "ATVId_1" }, "wrong")).status, 404);

  const start = await post({ sessionId: "ATVId_1", callerNumber: PHONE, isActive: "1" });
  assert.equal(
    start.text.replace(/127\.0\.0\.1:\d+/, "HOST"),
    '<?xml version="1.0" encoding="UTF-8"?><Response>' +
      '<GetDigits timeout="20" numDigits="1" callbackUrl="http://HOST/api/voice?key=voice-key">' +
      '<Say voice="woman">Welcome to FarmBok, your farm record assistant. Please select your preferred language. Press 1 for English. Press 2 for Kpelle. Press 3 for Bassa.</Say>' +
      '</GetDigits><Say voice="woman">We did not hear any keys. Please call again. Goodbye.</Say></Response>'
  );
  const pin = await post({ sessionId: "ATVId_1", callerNumber: PHONE, isActive: "1", dtmfDigits: "1" });
  assert.match(pin.text, /finishOnKey="#"/);
  const menu = await post({ sessionId: "ATVId_1", callerNumber: PHONE, isActive: "1", dtmfDigits: "1234" });
  assert.match(menu.text, /Press 9 to end the call/);
  const hangup = await post({ sessionId: "ATVId_1", callerNumber: PHONE, isActive: "0" });
  assert.equal(hangup.text, "");
  const { rows } = await query("SELECT ended_reason FROM channel_sessions WHERE session_key = 'ATVId_1'");
  assert.equal(rows[0].ended_reason, "hangup");
  delete process.env.VOICE_SECRET;
});

test("screens become spoken words, money the way people say it", () => {
  assert.equal(spoken("Weather for which county?\n1. Bomi\n2. Bong"), "Weather for which county? Press 1 for bomi. Press 2 for bong.");
  assert.equal(
    spoken("Eggs US$0.13/egg; Oil L$2.5/gallon; Fish US$1/pack; Rice L$3,523/bag"),
    "Eggs 13 US cents per egg. Oil 2 Liberian dollars and 50 cents per gallon. Fish 1 US dollar per pack. Rice 3,523 Liberian dollars per bag"
  );
  assert.equal(spoken("profit -L$780"), "profit minus 780 Liberian dollars");
});
