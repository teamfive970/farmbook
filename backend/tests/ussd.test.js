import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { api, closeDatabase, createFarmerRecord, loginAs, query, resetDatabase, startServer } from "./helpers.js";
import { setWeatherFetcher } from "../src/services/weatherService.js";

// USSD in the Africa's Talking format (the sandbox sends the same requests).

let server;
const PHONE = "+231775550100";
let sessionCount = 0;

async function post(fields, key = "test-ussd-key") {
  const response = await fetch(`${server.baseUrl}/api/ussd${key ? `?key=${key}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields)
  });
  return { status: response.status, text: await response.text() };
}

// One USSD session: each call sends the whole answer list so far, like the gateway.
function session(phone = PHONE) {
  const sessionId = `ATUid_test_${++sessionCount}`;
  return async (text) => (await post({ sessionId, serviceCode: "*384*1#", phoneNumber: phone, text })).text;
}

async function farmerWithFarm({ phone = PHONE, pin = "1234" } = {}) {
  const { farmer } = await createFarmerRecord({ phoneNumber: phone, pin, fullName: "Musu Kollie" });
  const token = (await loginAs(server.baseUrl, phone, pin)).body.token;
  const farm = await api(server.baseUrl, "/api/farms", {
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
  assert.equal(farm.status, 201);
  return { farmer, token, farm: farm.body.farm };
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
  assert.equal((await post({ sessionId: "a", phoneNumber: PHONE, text: "" }, "")).status, 404);
  assert.equal((await post({ sessionId: "a", phoneNumber: PHONE, text: "" }, "wrong-key-xx")).status, 404);
});

test("registration: a new number makes an account, then signs in with it", async () => {
  const dial = session();
  assert.match(await dial(""), /^CON Welcome to FarmBok\.\n1\. Make my account\n2\. Weather\n3\. Market prices\n4\. Help/);
  assert.match(await dial("1"), /^CON Your full name/);
  assert.match(await dial("1*Musu Kollie"), /^CON Your county:\n1\. Bomi/);
  assert.match(await dial("1*Musu Kollie*9"), /^CON Your county:\n1\. Margibi/);
  assert.match(await dial("1*Musu Kollie*2*Jorquelleh*Gbarnga"), /PIN, 4 to 6/);
  assert.match(await dial("1*Musu Kollie*2*Jorquelleh*Gbarnga*1234"), /same PIN again/);
  assert.match(await dial("1*Musu Kollie*2*Jorquelleh*Gbarnga*1234*1234"), /^END Your FarmBok account is ready, Musu/);
  const { rows } = await query("SELECT full_name, county FROM farmers WHERE phone_number = $1", [PHONE]);
  assert.deepEqual(rows[0], { full_name: "Musu Kollie", county: "Bong" });

  // Mismatched PINs save nothing (new number, new session).
  const other = session("+231775550199");
  assert.match(await other("1*Ben*2*D*C*1234*9999"), /^END The two PINs are not the same/);
  assert.equal((await query("SELECT count(*)::int AS n FROM farmers WHERE phone_number = '+231775550199'")).rows[0].n, 0);

  // The same account works in the app.
  assert.equal((await loginAs(server.baseUrl, PHONE, "1234")).status, 200);
});

test("authentication: PIN once per session, main menu, exit; wrong PINs count toward the lock", async () => {
  await farmerWithFarm();
  const dial = session();
  assert.equal(await dial(""), "CON FarmBok. Hello Musu.\nPut your PIN:");
  const menu = await dial("1234");
  assert.equal(
    menu,
    "CON Welcome to FarmBok.\n1. Farm Activities\n2. Record Harvest\n3. Record Sales\n4. Farm Summary\n5. Weather Information\n6. Market Prices\n7. Notifications\n8. Help\n0. Exit"
  );
  assert.match(await dial("1234*8"), /^END FarmBok help/);

  const out = session();
  assert.equal(await out("1234*0"), "END You are signed out. Goodbye.");

  for (let i = 0; i < 4; i += 1) assert.equal(await session()("9999"), "END Wrong PIN. Please try again later.");
  assert.match(await session()("9999"), /^END Too many wrong tries/);
  // Locked even with the right PIN.
  assert.match(await session()("1234"), /^END Too many wrong tries/);
});

test("farm activity: farm, work, date, note, confirm, saved once and seen in the app", async () => {
  const { token } = await farmerWithFarm();
  const dial = session();
  assert.match(await dial("1234*1"), /^CON What work\?\n1\. Land preparation/);
  assert.match(await dial("1234*1*3"), /^CON When\?\n1\. Today\n2\. Yesterday\n3\. Other day/);
  assert.match(await dial("1234*1*3*3"), /Type the day and month/);
  assert.match(await dial("1234*1*3*3*0511"), /^CON Add a short note/);
  assert.match(await dial("1234*1*3*3*0511*Swamp side"), /^CON Save Weeding on Green Valley, 5 November\?\n1\. Save\n2\. Cancel/);
  const saved = await dial("1234*1*3*3*0511*Swamp side*1");
  assert.match(saved, /^END Saved: Weeding on Green Valley, 5 November/);
  // The gateway repeats the last request: same answer, nothing saved twice.
  assert.equal(await dial("1234*1*3*3*0511*Swamp side*1"), saved);

  const list = await api(server.baseUrl, "/api/activities", { token });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].activityType, "weeding");
  assert.match(list.body.items[0].notes, /Recorded by USSD: Swamp side/);
});

test("harvest: saved through the harvest service and shown in the app and reports", async () => {
  const { token } = await farmerWithFarm();
  const dial = session();
  assert.match(await dial("1234*2"), /^CON What did you harvest\?\n1\. Rice\n2\. Cassava/);
  assert.match(await dial("1234*2*1"), /How many\?/);
  assert.match(await dial("1234*2*1*25"), /^CON Which unit\?\n1\. Bags/);
  assert.match(await dial("1234*2*1*25*1*1"), /^CON Save harvest: 25 bags of Rice from Green Valley, today\?/);
  assert.match(await dial("1234*2*1*25*1*1*1"), /^END Saved: 25 bags of Rice/);

  const harvests = await api(server.baseUrl, "/api/harvests", { token });
  assert.equal(harvests.body.items.length, 1);
  assert.equal(harvests.body.items[0].crop, "Rice");
  assert.equal(Number(harvests.body.items[0].quantity), 25);
  assert.ok(harvests.body.items[0].passportCode);
  const report = await api(server.baseUrl, "/api/reports/summary", { token });
  assert.deepEqual(report.body.harvest.map((row) => [row.crop, row.quantity]), [["Rice", 25]]);
});

test("cancel and invalid input save nothing", async () => {
  const { token } = await farmerWithFarm();
  assert.match(await session()("1234*2*1*25*1*1*2"), /^END Cancelled\. Nothing was saved/);
  assert.equal(await session()("1234*2*7"), "END Wrong choice. Please dial again.");
  assert.equal(await session()("1234*2*1*lots"), "END Wrong choice. Please dial again.");
  assert.equal(await session()("1234*1*3*3*3199"), "END Wrong choice. Please dial again.");
  assert.equal(await session()("1234*9"), "END Wrong choice. Please dial again.");
  // An unfinished session (the farmer walked away before Save) saves nothing either.
  await session()("1234*2*1*25*1*1");
  const harvests = await api(server.baseUrl, "/api/harvests", { token });
  assert.equal(harvests.body.items.length, 0);
});

test("sales: from a harvest, with payment and a cost; can't sell more than is left", async () => {
  const { token } = await farmerWithFarm();
  await session()("1234*2*1*20*1*1*1");
  const dial = session();
  assert.match(await dial("1234*3"), /^CON Which harvest did you sell from\?\n1\. Rice 20 bags \(today\)/);
  assert.match(await dial("1234*3*1"), /How many bags did you sell\? 20 left/);
  assert.match(await dial("1234*3*1*5"), /Price for one bag\?/);
  assert.match(await dial("1234*3*1*5*1500*1*1"), /Any cost for this sale/);
  assert.match(await dial("1234*3*1*5*1500*1*1*300"), /^CON What was the cost for\?\n1\. Transport/);
  assert.match(
    await dial("1234*3*1*5*1500*1*1*300*1"),
    /^CON Sell 5 bags Rice at L\$1,500 = L\$7,500\. Paid\. Cost L\$300\. Save\?/
  );
  assert.match(await dial("1234*3*1*5*1500*1*1*300*1*1"), /^END Saved: sale of 5 bags Rice for L\$7,500/);
  assert.match(await dial("1234*3*1*5*1500*1*1*300*1*1"), /^END Saved/); // repeat: still one sale

  const sales = await api(server.baseUrl, "/api/sales", { token });
  assert.equal(sales.body.items.length, 1);
  assert.equal(Number(sales.body.items[0].totalAmount), 7500);
  const payments = await api(server.baseUrl, "/api/payments", { token });
  assert.equal(payments.body.items.length, 1);
  const expenses = await api(server.baseUrl, "/api/expenses", { token });
  assert.deepEqual(expenses.body.items.map((row) => [row.category, Number(row.amount)]), [["transport", 300]]);
  const report = await api(server.baseUrl, "/api/reports/summary", { token });
  assert.equal(report.body.money.received.LRD, 7500);
  assert.equal(report.body.money.spent.LRD, 300);

  assert.match(await session()("1234*3*1*16"), /^END Only 15 bags left in that harvest/);
  // Not paid yet: the sale is saved, no payment.
  await session()("1234*3*1*2*1000*1*2*0*1");
  assert.equal((await api(server.baseUrl, "/api/payments", { token })).body.items.length, 1);
  assert.equal((await api(server.baseUrl, "/api/sales", { token })).body.items.length, 2);
});

test("financial summary, weather and market prices (labelled as FarmBok farmers' sales)", async () => {
  await farmerWithFarm();
  await session()("1234*2*1*20*1*1*1");
  await session()("1234*3*1*4*2000*1*1*0*1");
  assert.match(await session()("1234*4"), /^CON Your farm summary\.\n1\. Money\n2\. Harvests\n3\. Recent sales/);
  assert.match(
    await session()("1234*4*1"),
    /^END Money in Liberian dollars: income L\$8,000, expenses L\$0, profit L\$8,000\./
  );
  assert.match(await session()("1234*4*2"), /^END Harvests: Rice 20 bags\./);
  assert.match(await session()("1234*4*3"), /^END Recent sales: Rice 4 bags L\$8,000 \(today\)\./);
  assert.match(await session()("1234*5"), /^END Bong today: rain, 12 mm rain, 22C to 29C\. Tomorrow: dry, up to 31C\./);
  // One farmer's sale is not enough for a public price.
  assert.equal(await session()("1234*6"), "END No market prices yet. More farmers need to record sales.");
  // Anyone (no account) can see weather.
  assert.match(await session("+231775550177")("2*2"), /^END Bong today/);
});

test("market prices name their source once enough farmers have sold", async () => {
  for (const [index, phone] of ["+231775550101", "+231775550102", "+231775550103"].entries()) {
    const { farmer } = await createFarmerRecord({ phoneNumber: phone, fullName: `Farmer ${index}` });
    await query(
      `INSERT INTO sales (farmer_id, client_id, sale_date, crop, quantity, unit, unit_price, total_amount, currency)
       VALUES ($1, $2, current_date, 'Rice', 1, 'bags', 3000, 3000, 'LRD')`,
      [farmer.id, `sale-client-${index}`]
    );
  }
  const reply = await session("+231775550177")("3");
  assert.match(reply, /^END FarmBok farmers' sales, Liberia, \d+ days \(not outside-checked\):\nRice L\$3,000\/bag/);
  assert.ok(reply.length <= 182);
});

test("notifications: read messages once, weekly price SMS switch is not undone by a repeat", async () => {
  const { farmer } = await farmerWithFarm();
  await query("INSERT INTO notifications (farmer_id, kind, topic, title, body) VALUES ($1, 'announcement', 'news', 'Seed fair Saturday', 'Come.')", [farmer.id]);
  const dial = session();
  assert.match(await dial("1234*7"), /^CON 1\. Read new messages\n2\. Weekly price SMS/);
  assert.match(await dial("1234*7*1"), /Seed fair Saturday/);
  assert.match(await session()("1234*7*1"), /No new messages/);

  const sms = session();
  assert.match(await sms("1234*7*2"), /Get market prices by SMS every week\?/);
  assert.match(await sms("1234*7*2*1"), /now ON/);
  assert.match(await sms("1234*7*2*1"), /now ON/);
  assert.equal((await query("SELECT price_sms FROM farmers WHERE id = $1", [farmer.id])).rows[0].price_sms, true);
});

test("sessions: stored without PINs, expire, and can't be continued after they end", async () => {
  await farmerWithFarm();
  const sessionId = "ATUid_expiry_1";
  const send = async (text) => (await post({ sessionId, phoneNumber: PHONE, text })).text;
  assert.match(await send("1234"), /^CON Welcome/);
  const { rows } = await query("SELECT state::text, authenticated_at FROM channel_sessions WHERE session_key = $1", [sessionId]);
  assert.ok(rows[0].authenticated_at);
  assert.ok(!rows[0].state.includes("1234"), "no PIN in the session");

  await query("UPDATE channel_sessions SET expires_at = now() - interval '1 second' WHERE session_key = $1", [sessionId]);
  assert.equal(await send("1234*8"), "END Your session has ended. Please dial again.");

  // A session from another phone number can't be taken over.
  assert.equal(
    (await post({ sessionId: "ATUid_owner", phoneNumber: PHONE, text: "" })).text,
    "CON FarmBok. Hello Musu.\nPut your PIN:"
  );
  assert.match((await post({ sessionId: "ATUid_owner", phoneNumber: "+231775550188", text: "" })).text, /^END Sorry/);
});

test("every USSD screen fits on a phone (182 characters)", async () => {
  const { token } = await farmerWithFarm();
  for (let i = 0; i < 8; i += 1) {
    await api(server.baseUrl, "/api/harvests", {
      method: "POST",
      token,
      body: {
        clientId: `harvest-long-${i}`,
        farmClientId: "farm-client-0001",
        crop: i % 2 ? "Cassava" : "Rice",
        quantity: 1000 + i,
        unit: "bags",
        harvestDate: "2026-11-01"
      }
    });
  }
  for (const text of ["", "1234", "1234*1", "1234*2*1", "1234*2*1*5", "1234*3", "1234*3*1*5*1500*1*1*300*1", "1234*4*2", "1234*5", "1234*7"]) {
    const reply = await session()(text);
    assert.ok(reply.length <= 182, `${text}: ${reply.length} ${reply}`);
  }
});
