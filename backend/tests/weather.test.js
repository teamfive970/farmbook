import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, startServer } from "./helpers.js";
import { farmTips, setWeatherFetcher } from "../src/services/weatherService.js";

let server;
let calls = 0;
let mode = "ok";

function fakeDays({ rain = [0, 0, 0, 0, 0, 0, 0], code = 1, tmax = 30 } = {}) {
  return {
    current: { temperature_2m: 27.4, relative_humidity_2m: 80, precipitation: 0, weather_code: code, wind_speed_10m: 9 },
    daily: {
      time: rain.map((_, i) => `2026-11-${String(20 + i).padStart(2, "0")}`),
      weather_code: rain.map((mm) => (mm >= 30 ? 65 : mm >= 5 ? 61 : code)),
      temperature_2m_max: rain.map(() => tmax),
      temperature_2m_min: rain.map(() => 22),
      precipitation_sum: rain,
      precipitation_probability_max: rain.map((mm) => (mm >= 5 ? 90 : 10)),
      wind_speed_10m_max: rain.map(() => 12)
    }
  };
}
let payload = fakeDays();

before(async () => {
  setWeatherFetcher(async (url) => {
    calls += 1;
    assert.match(url, /latitude=7&longitude=-9.47|latitude=6.3/);
    if (mode === "fail") throw new Error("network down");
    return { ok: true, json: async () => payload };
  });
  server = await startServer();
});
beforeEach(() => {
  mode = "ok";
});
after(async () => {
  setWeatherFetcher(null);
  await server.close();
  await closeDatabase();
});

test("weather for a county returns days, current and tips; is cached", async () => {
  calls = 0;
  const first = await api(server.baseUrl, "/api/weather?county=bong");
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.county, "Bong");
  assert.equal(first.body.town, "Gbarnga");
  assert.equal(first.body.days.length, 7);
  assert.equal(first.body.current.temp, 27);
  assert.ok(first.body.tips.some((t) => t.key === "dry_days"));
  assert.equal(first.body.stale, false);
  await api(server.baseUrl, "/api/weather?county=Bong");
  assert.equal(calls, 1, "second call served from cache");
});

test("unknown county is rejected", async () => {
  const res = await api(server.baseUrl, "/api/weather?county=Atlantis");
  assert.equal(res.status, 400);
});

test("service down: stale copy if we have one, else 503", async () => {
  process.env.WEATHER_CACHE_MINUTES = "0";
  mode = "fail";
  const stale = await api(server.baseUrl, "/api/weather?county=Bong");
  assert.equal(stale.status, 200);
  assert.equal(stale.body.stale, true);
  const none = await api(server.baseUrl, "/api/weather?county=Montserrado");
  assert.equal(none.status, 503);
  delete process.env.WEATHER_CACHE_MINUTES;
});

test("farm tips follow the rain", () => {
  const shape = (rain, tmax = 30) =>
    rain.map((mm) => ({ rainMm: mm, rainChance: mm >= 5 ? 90 : 10, kind: mm >= 30 ? "heavy" : "partly", tempMax: tmax }));
  const wet = farmTips(shape([12, 40, 3, 0, 0, 0, 0])).map((t) => t.key);
  assert.ok(wet.includes("heavy_rain"));
  assert.ok(wet.includes("no_spray"));
  assert.ok(!wet.includes("dry_days"));
  const dry = farmTips(shape([0, 0, 0, 0, 0, 0, 0], 35)).map((t) => t.key);
  assert.deepEqual(dry.sort(), ["dry_days", "dry_week", "heat"].sort());
  const mixed = farmTips(shape([0, 3, 2, 8, 0, 0, 0])).map((t) => t.key);
  assert.ok(mixed.includes("dry_today"));
});

test("heavy rain alerts reach farmers once, with SMS when allowed", async () => {
  const { query, resetDatabase } = await import("./helpers.js");
  const { setSmsTransportForTests } = await import("../src/lib/sms.js");
  const { runWeatherAlerts } = await import("../src/services/weatherAlertService.js");
  await resetDatabase();
  const sent = [];
  setSmsTransportForTests(async (phone, message) => sent.push({ phone, message }));
  try {
    const register = (phoneNumber, county) =>
      api(server.baseUrl, "/api/auth/register", {
        method: "POST",
        body: { fullName: "Kebeh Flomo", phoneNumber, county, district: "Town", community: "Village", pin: "1122", confirmPin: "1122" }
      });
    assert.equal((await register("0775550001", "Bong")).status, 201);
    assert.equal((await register("0775550002", "Bong")).status, 201);
    await query("UPDATE farmers SET notify_sms = false WHERE phone_number LIKE '%5550002'");
    process.env.WEATHER_CACHE_MINUTES = "0";
    payload = fakeDays({ rain: [2, 45, 3, 0, 0, 0, 0] });
    const first = await runWeatherAlerts();
    assert.deepEqual(first, [{ county: "Bong", farmers: 2, sms: 1 }]);
    assert.equal(sent.length, 1);
    assert.match(sent[0].message, /Heavy rain is coming in Bong County tomorrow/);
    const again = await runWeatherAlerts();
    assert.deepEqual(again, [{ county: "Bong", farmers: 0, sms: 0 }]);
    assert.equal(sent.length, 1, "no second SMS for the same rain day");
    const { rows } = await query("SELECT count(*)::int AS n FROM notifications WHERE topic = 'weather'");
    assert.equal(rows[0].n, 2);
    payload = fakeDays();
    assert.deepEqual(await runWeatherAlerts(), []);
  } finally {
    setSmsTransportForTests(null);
    delete process.env.WEATHER_CACHE_MINUTES;
  }
});
