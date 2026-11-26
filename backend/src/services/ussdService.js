import { query } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { ApiError } from "../lib/errors.js";
import { assertNotLocked, clearFailures, recordFailure } from "../lib/lockout.js";
import { normalizePhone } from "../lib/phone.js";
import { verifyPin } from "../lib/pin.js";
import { shortPrice } from "../lib/text.js";
import { registerFarmer } from "./authService.js";
import { createActivity } from "./activityService.js";
import { getMarketPrices } from "./marketService.js";
import { refreshReminders } from "./notificationService.js";
import { moneyAndHarvestTotals } from "./reportService.js";
import { getCountyWeather } from "./weatherService.js";

// USSD menu for farmers without a smartphone (dial a short code such as
// *384*123#). Works with the Africa's Talking USSD format: every request
// carries the whole session so far in `text`, answers separated by "*".
// A reply starting "CON " waits for the next answer; "END " closes the menu.
//
// The menu is worked out again from the start on each request, so the server
// keeps no session state. Signed-in steps check the PIN every time.

const MAX = 182; // what most phones show on one USSD screen
const con = (text) => `CON ${text}`;
const end = (text) => {
  const body = text.length > MAX - 4 ? `${text.slice(0, MAX - 7)}...` : text;
  return `END ${body}`;
};
const list = (items) => items.map((item, index) => `${index + 1}. ${item}`).join("\n");
const WRONG = end("Wrong choice. Please dial again.");

// Reads the farmer's answers one at a time.
class Answers {
  constructor(text) {
    this.items = text ? String(text).split("*") : [];
    this.index = 0;
  }
  next() {
    return this.index < this.items.length ? this.items[this.index++].trim() : undefined;
  }
}

function pick(value, options) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= options.length ? options[number - 1] : null;
}

// Counties take two screens: 1-8, then 9 for the rest.
function askCounty(answers, title) {
  const first = COUNTIES.slice(0, 8);
  const rest = COUNTIES.slice(8);
  const page1 = answers.next();
  if (page1 === undefined) return { reply: con(`${title}\n${list(first)}\n9. More`) };
  if (page1 === "9") {
    const page2 = answers.next();
    if (page2 === undefined) return { reply: con(`${title}\n${list(rest)}`) };
    const county = pick(page2, rest);
    return county ? { county } : { reply: WRONG };
  }
  const county = pick(page1, first);
  return county ? { county } : { reply: WRONG };
}

// ---------------------------------------------------------------------------
// Weather and prices (anyone)
// ---------------------------------------------------------------------------

function rainShort(day) {
  if (day.rainMm >= 30) return "heavy rain";
  if (day.rainMm >= 5 || (day.rainChance ?? 0) >= 70) return "rain";
  if (day.rainMm >= 1 || (day.rainChance ?? 0) >= 40) return "maybe rain";
  return "dry";
}

async function weatherText(county) {
  try {
    const weather = await getCountyWeather(county);
    const [today, tomorrow] = weather.days;
    const tip = weather.tips[0]?.text || "";
    const tomorrowText = tomorrow ? ` Tmrw: ${rainShort(tomorrow)}, ${tomorrow.tempMax}C.` : "";
    return end(`${county}: Today ${rainShort(today)}, ${today.tempMax}C.${tomorrowText} ${tip}`);
  } catch {
    return end("Weather is not available right now. Try again later.");
  }
}

const CURRENCY = { LRD: "L$", USD: "US$" };

async function pricesText(county) {
  let data = await getMarketPrices(county ? { county } : {});
  let place = county ? `${county}` : "Liberia";
  if (county && !data.prices.length) {
    data = await getMarketPrices({});
    place = "Liberia";
  }
  if (!data.prices.length) return end("No market prices yet. More farmers need to record sales.");
  const lines = data.prices
    .slice(0, 4)
    .map((item) => `${item.crop} ${CURRENCY[item.currency] || ""}${shortPrice(item.median)}/${String(item.unit).replace(/s$/, "")}`);
  return end(`Prices (${place}, last ${data.days} days): ${lines.join("; ")}`);
}

// ---------------------------------------------------------------------------
// New farmer
// ---------------------------------------------------------------------------

async function newFarmer(answers, phone) {
  const choice = answers.next();
  if (choice === undefined) {
    return con("Welcome to FarmBok. Keep your farm records.\n1. Make my account\n2. Weather\n3. Market prices");
  }
  if (choice === "2") {
    const { county, reply } = askCounty(answers, "Weather for which county?");
    return reply || weatherText(county);
  }
  if (choice === "3") return pricesText(null);
  if (choice !== "1") return WRONG;

  const name = answers.next();
  if (name === undefined) return con("Your full name:");
  if (name.length < 2) return end("Name is too short. Please dial again.");
  const { county, reply } = askCounty(answers, "Your county:");
  if (reply) return reply;
  const district = answers.next();
  if (district === undefined) return con("Your district:");
  const community = answers.next();
  if (community === undefined) return con("Your town or village:");
  const pin = answers.next();
  if (pin === undefined) return con("Make a secret PIN, 4 to 6 numbers:");
  if (!/^\d{4,6}$/.test(pin)) return end("PIN must be 4 to 6 numbers. Please dial again.");
  const again = answers.next();
  if (again === undefined) return con("Put the same PIN again:");
  if (again !== pin) return end("The two PINs are not the same. Please dial again.");

  try {
    await registerFarmer({ fullName: name, phoneNumber: phone, county, district, community, pin, confirmPin: again });
  } catch (error) {
    if (error instanceof ApiError) return end(error.message);
    throw error;
  }
  return end(`Your FarmBok account is ready, ${name.split(/\s+/)[0]}. Dial again to record your work, or use the app with this phone number and PIN.`);
}

// ---------------------------------------------------------------------------
// Signed-in farmer
// ---------------------------------------------------------------------------

const WORK = [
  ["Land preparation", "land_preparation"],
  ["Planting", "planting"],
  ["Weeding", "weeding"],
  ["Fertilizer", "fertilizer_application"],
  ["Spraying", "pesticide_application"],
  ["Watering", "watering"],
  ["Feeding animals", "feeding"],
  ["Checking the farm", "monitoring"]
];
export const WORK_LABELS = WORK.map(([label]) => label);

function dateOnly(daysAgo) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return date.toISOString().slice(0, 10);
}

async function recordWork(answers, farmer, sessionId) {
  const { rows: farms } = await query(
    "SELECT id, farm_name, county FROM farms WHERE farmer_id = $1 ORDER BY created_at LIMIT 8",
    [farmer.id]
  );
  if (!farms.length) return end("You have no farm yet. Add your farm in the FarmBok app first.");
  let farm = farms[0];
  if (farms.length > 1) {
    const choice = answers.next();
    if (choice === undefined) return con(`Which farm?\n${list(farms.map((row) => row.farm_name))}`);
    farm = pick(choice, farms);
    if (!farm) return WRONG;
  }
  const workChoice = answers.next();
  if (workChoice === undefined) return con(`What work?\n${list(WORK.map(([label]) => label))}`);
  const work = pick(workChoice, WORK);
  if (!work) return WRONG;
  const dayChoice = answers.next();
  if (dayChoice === undefined) return con("When?\n1. Today\n2. Yesterday");
  if (dayChoice !== "1" && dayChoice !== "2") return WRONG;

  // One record per USSD session, so a repeated request does not save twice.
  await createActivity(farmer.id, {
    clientId: `ussd-session-${sessionId}`.slice(0, 100),
    farmId: farm.id,
    activityType: work[1],
    activityDate: dateOnly(dayChoice === "1" ? 0 : 1),
    notes: "Recorded by USSD"
  });
  return end(`Saved: ${work[0]} on ${farm.farm_name}, ${dayChoice === "1" ? "today" : "yesterday"}. Thank you.`);
}

async function farmCounty(farmer) {
  const { rows } = await query("SELECT county FROM farms WHERE farmer_id = $1 ORDER BY created_at LIMIT 1", [farmer.id]);
  return rows[0]?.county || farmer.county;
}

async function messagesText(farmer) {
  await refreshReminders(farmer.id);
  const { rows } = await query(
    `SELECT id, title FROM notifications WHERE farmer_id = $1 AND read_at IS NULL
     ORDER BY created_at DESC LIMIT 3`,
    [farmer.id]
  );
  if (!rows.length) return end("No new messages.");
  await query("UPDATE notifications SET read_at = now() WHERE id = ANY($1::uuid[])", [rows.map((row) => row.id)]);
  return end(rows.map((row, index) => `${index + 1}. ${row.title}`).join("\n"));
}

async function moneyText(farmer) {
  const totals = await moneyAndHarvestTotals(farmer.id, {});
  const parts = [];
  for (const currency of ["LRD", "USD"]) {
    const received = totals.money.received[currency] || 0;
    const spent = totals.money.spent[currency] || 0;
    if (!received && !spent) continue;
    const sign = CURRENCY[currency];
    const profit = totals.money.profit[currency];
    parts.push(`${sign}: got ${sign}${Math.round(received)}, spent ${sign}${Math.round(spent)}, profit ${profit < 0 ? "-" : ""}${sign}${Math.abs(Math.round(profit))}`);
  }
  return end(parts.length ? `Your money (all time). ${parts.join(". ")}` : "No money records yet.");
}

async function priceSmsSwitch(answers, farmer) {
  const { rows } = await query("SELECT price_sms FROM farmers WHERE id = $1", [farmer.id]);
  const on = rows[0]?.price_sms;
  const choice = answers.next();
  if (choice === undefined) {
    return con(
      on
        ? "Weekly price SMS is ON.\n1. Turn it off\n2. Keep it on"
        : "Get market prices by SMS every week?\n1. Yes, turn it on\n2. No"
    );
  }
  if (choice !== "1" && choice !== "2") return WRONG;
  if (choice === "2") return end(on ? "OK. You will still get prices every week." : "OK. No price SMS.");
  await query("UPDATE farmers SET price_sms = $1, updated_at = now() WHERE id = $2", [!on, farmer.id]);
  return end(on ? "Weekly price SMS is now OFF." : "Weekly price SMS is now ON. Your first prices will come soon.");
}

async function knownFarmer(answers, farmer, sessionId) {
  const pin = answers.next();
  if (pin === undefined) return con(`FarmBok. Hello ${farmer.full_name.split(/\s+/)[0]}.\nPut your PIN:`);
  try {
    assertNotLocked(farmer, "login");
  } catch (error) {
    return end(error.message);
  }
  if (!(await verifyPin(pin, farmer.pin_hash))) {
    const until = await recordFailure("farmer", farmer.id, "login");
    return end(
      until && new Date(until).getTime() > Date.now()
        ? "Too many wrong tries. Wait some minutes and dial again."
        : "Wrong PIN. Please dial again."
    );
  }
  if (farmer.failed_login_count > 0 || farmer.locked_until) await clearFailures("farmer", farmer.id, ["login"]);
  if (farmer.status !== "active") return end("This account is not active. Please contact your extension officer.");

  const choice = answers.next();
  if (choice === undefined) {
    return con("1. Record farm work\n2. Weather\n3. Market prices\n4. My messages\n5. My money\n6. Weekly price SMS");
  }
  if (choice === "1") return recordWork(answers, farmer, sessionId);
  if (choice === "2") return weatherText(await farmCounty(farmer));
  if (choice === "3") return pricesText(farmer.county);
  if (choice === "4") return messagesText(farmer);
  if (choice === "5") return moneyText(farmer);
  if (choice === "6") return priceSmsSwitch(answers, farmer);
  return WRONG;
}

export async function handleUssd({ sessionId, phoneNumber, text } = {}) {
  const phone = normalizePhone(String(phoneNumber || ""));
  if (!phone) return end("FarmBok works with Liberian phone numbers only.");
  const session = String(sessionId || "").slice(0, 80) || `${phone}-${Date.now()}`;
  const answers = new Answers(text);
  const { rows } = await query(
    `SELECT id, full_name, county, status, pin_hash, failed_login_count, locked_until
     FROM farmers WHERE phone_number = $1`,
    [phone]
  );
  return rows[0] ? knownFarmer(answers, rows[0], session) : newFarmer(answers, phone);
}
