import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, query, resetDatabase, startServer } from "./helpers.js";
import { setWeatherFetcher } from "../src/services/weatherService.js";

let server;
const PHONE = "+231775550100";

async function dial(text, { phone = PHONE, session = "s1", key = "test-ussd-key" } = {}) {
  const response = await fetch(`${server.baseUrl}/api/ussd${key ? `?key=${key}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sessionId: session, serviceCode: "*384*1#", phoneNumber: phone, text })
  });
  return { status: response.status, text: await response.text() };
}

before(async () => {
  process.env.USSD_SECRET = "test-ussd-key";
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
  delete process.env.USSD_SECRET;
  await server.close();
  await closeDatabase();
});

test("USSD is hidden without the secret key", async () => {
  assert.equal((await dial("", { key: "" })).status, 404);
  assert.equal((await dial("", { key: "wrong-key-xx" })).status, 404);
});

test("a new farmer makes an account by USSD, then signs in and records work", async () => {
  const first = await dial("");
  assert.match(first.text, /^CON Welcome to FarmBok/);
  assert.match((await dial("1")).text, /^CON Your full name/);
  assert.match((await dial("1*Musu Kollie")).text, /^CON Your county:\n1\. Bomi/);
  assert.match((await dial("1*Musu Kollie*9")).text, /^CON Your county:\n1\. Margibi/);
  assert.match((await dial("1*Musu Kollie*2*Jorquelleh*Gbarnga")).text, /PIN, 4 to 6/);
  assert.match((await dial("1*Musu Kollie*2*Jorquelleh*Gbarnga*1234*9999")).text, /^END The two PINs/);
  const done = await dial("1*Musu Kollie*2*Jorquelleh*Gbarnga*1234*1234");
  assert.match(done.text, /^END Your FarmBok account is ready, Musu/);
  const { rows } = await query("SELECT id, county FROM farmers WHERE phone_number = $1", [PHONE]);
  assert.equal(rows[0].county, "Bong");

  // Same login works in the app.
  const login = await api(server.baseUrl, "/api/auth/login", { method: "POST", body: { identifier: "0775550100", pin: "1234" } });
  assert.equal(login.status, 200);
  const token = login.body.token;

  // No farm yet.
  assert.match((await dial("1234*1")).text, /no farm yet/);
  for (const name of ["Swamp farm", "Upland farm"]) {
    const farm = await api(server.baseUrl, "/api/farms", {
      method: "POST",
      token,
      body: { clientId: `farm-${name.replace(/\W/g, "")}-0001`, farmName: name, county: "Bong", district: "J", community: "G", farmType: "crop_farming", crops: ["Rice"] }
    });
    assert.equal(farm.status, 201, JSON.stringify(farm.body));
  }

  assert.match((await dial("1234")).text, /^CON 1\. Record farm work/);
  assert.match((await dial("1234*1")).text, /^CON Which farm\?\n1\. Swamp farm\n2\. Upland farm/);
  assert.match((await dial("1234*1*2")).text, /^CON What work\?/);
  assert.match((await dial("1234*1*2*3")).text, /^CON When\?/);
  const saved = await dial("1234*1*2*3*1", { session: "sess-77" });
  assert.equal(saved.text, "END Saved: Weeding on Upland farm, today. Thank you.");
  await dial("1234*1*2*3*1", { session: "sess-77" }); // gateway retry
  const work = await query("SELECT activity_type, notes FROM farm_activities WHERE farmer_id = $1", [rows[0].id]);
  assert.equal(work.rows.length, 1, "a retried request does not save twice");
  assert.equal(work.rows[0].activity_type, "weeding");

  assert.match((await dial("1234*2")).text, /^END Bong: Today rain, 29C\. Tmrw: dry/);
  assert.match((await dial("1234*3")).text, /^END No market prices yet/);
  assert.match((await dial("1234*4")).text, /^END 1\. /);
  assert.match((await dial("1234*5")).text, /^END No money records yet/);
});

test("wrong PIN by USSD counts toward the lock", async () => {
  await dial("1*Jallah Kpoto*1*Klay*Tubmanburg*4321*4321", { phone: "+231775550200" });
  for (let i = 0; i < 4; i += 1) {
    assert.match((await dial("0000", { phone: "+231775550200" })).text, /^END Wrong PIN/);
  }
  assert.match((await dial("0000", { phone: "+231775550200" })).text, /Too many wrong tries/);
  assert.match((await dial("4321", { phone: "+231775550200" })).text, /^END Too many wrong tries/);
});

test("anyone can get weather by county", async () => {
  assert.match((await dial("2", { phone: "+231775550300" })).text, /^CON Weather for which county\?/);
  assert.match((await dial("2*2", { phone: "+231775550300" })).text, /^END Bong: Today rain/);
  assert.match((await dial("7", { phone: "+231775550300" })).text, /^END Wrong choice/);
});
