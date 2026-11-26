import { query } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { ApiError } from "../lib/errors.js";
import { assertNotLocked, clearFailures, recordFailure } from "../lib/lockout.js";
import { verifyPin } from "../lib/pin.js";
import { shortPrice } from "../lib/text.js";
import { createActivity } from "../services/activityService.js";
import { registerFarmer } from "../services/authService.js";
import { ANIMAL_PRODUCTS, farmYields } from "../services/farmService.js";
import { getMarketPrices } from "../services/marketService.js";
import { refreshReminders } from "../services/notificationService.js";
import { moneyAndHarvestTotals } from "../services/reportService.js";
import { createRecord } from "../services/resourceService.js";
import { getCountyWeather } from "../services/weatherService.js";
import { VOICE_LANGUAGES } from "./prompts.js";

// The menu shared by USSD and the voice menu (IVR).
//
// A session is the list of answers given so far. The menu is worked out from
// the first answer every time, the way Africa's Talking USSD sends it, so the
// same answers always lead to the same screen. Anything that changes data
// (a save, a PIN check, a setting) runs once per session through ctx.once(),
// so a repeated callback or a replay never saves twice. Saves go through the
// same services as the app, so records show up in the app, reports and the
// Ministry dashboard.
//
// A screen is { id, end, parts, input }. Parts are prompt keys (words in
// backend/voice-prompts), plain text for things like names and numbers, or a
// numbered list. The USSD and voice renderers turn parts into a screen or
// speech.

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export const P = (key, params) => ({ key, params });
export const T = (text) => ({ text: String(text) });
export const L = (items) => ({ list: items.map(String) });

const ask = (id, parts, input = { kind: "choice" }) => ({ id, end: false, parts, input });
const done = (id, parts, { final = false } = {}) => ({ id, end: true, final, parts });
const invalid = (id) => ({ invalid: true, id });

// Reads the caller's answers one at a time, remembering where each was.
export class Answers {
  constructor(items) {
    this.items = items;
    this.index = 0;
  }
  static fromUssd(text) {
    return new Answers(text ? String(text).split("*").map((item) => item.trim()) : []);
  }
  get position() {
    return this.index;
  }
  next() {
    return this.index < this.items.length ? this.items[this.index++] : undefined;
  }
}

function pick(value, options) {
  const number = Number(value);
  return /^\d+$/.test(String(value)) && number >= 1 && number <= options.length ? options[number - 1] : null;
}

function amount(value, { allowZero = false } = {}) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(String(value || ""))) return null;
  const number = Number(value);
  if (number === 0 && !allowZero) return null;
  return number;
}

const CURRENCY = { LRD: "L$", USD: "US$" };
const money = (value, currency) => `${Number(value) < 0 ? "-" : ""}${CURRENCY[currency]}${shortPrice(Math.abs(Number(value)))}`;

function dateOnly(daysAgo) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

// "0511" -> this year's 5 November (or last year's if that is still to come).
function typedDate(value) {
  if (!/^\d{4}$/.test(String(value))) return null;
  const day = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const today = new Date();
  for (const year of [today.getUTCFullYear(), today.getUTCFullYear() - 1]) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (date.getTime() <= today.getTime()) return date.toISOString().slice(0, 10);
  }
  return null;
}

function dayWords(date) {
  if (date === dateOnly(0)) return "today";
  if (date === dateOnly(1)) return "yesterday";
  const [, month, day] = date.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months.at(month - 1)}`;
}

// When? 1 Today, 2 Yesterday, 3 another day (typed as DDMM).
function askDate(a, id) {
  const choice = a.next();
  if (choice === undefined) return { screen: ask(`${id}.when`, [P("common.when"), P("common.when.options")]) };
  if (choice === "1") return { date: dateOnly(0) };
  if (choice === "2") return { date: dateOnly(1) };
  if (choice !== "3") return { screen: invalid(`${id}.when`) };
  const typed = a.next();
  if (typed === undefined) return { screen: ask(`${id}.date`, [P("common.dateEntry")], { kind: "number", maxDigits: 4 }) };
  const date = typedDate(typed);
  return date ? { date } : { screen: invalid(`${id}.date`) };
}

async function confirm(a, id, parts, save) {
  const choice = a.next();
  if (choice === undefined) return ask(`${id}.confirm`, [...parts, P("common.confirm.options")]);
  if (choice === "2") return done(`${id}.cancelled`, [P("common.cancelled")]);
  if (choice !== "1") return invalid(`${id}.confirm`);
  return save();
}

// ---------------------------------------------------------------------------
// Farms
// ---------------------------------------------------------------------------

async function farmsOf(farmer) {
  const { rows } = await query(
    `SELECT id, client_id, farm_name, county, farm_type, crops FROM farms
     WHERE farmer_id = $1 ORDER BY created_at LIMIT 8`,
    [farmer.id]
  );
  return rows;
}

// Records point at a farm by its app id; a farm made outside the app may not
// have one yet.
async function farmClientId(farm) {
  if (farm.client_id) return farm.client_id;
  const { rows } = await query(
    "UPDATE farms SET client_id = COALESCE(client_id, 'farm-' || id::text) WHERE id = $1 RETURNING client_id",
    [farm.id]
  );
  return rows[0].client_id;
}

async function chooseFarm(a, farmer, id) {
  const farms = await farmsOf(farmer);
  if (!farms.length) return { screen: done(`${id}.nofarm`, [P("common.noFarm")]) };
  if (farms.length === 1) return { farm: farms[0] };
  const choice = a.next();
  if (choice === undefined) return { screen: ask(`${id}.farm`, [P("common.whichFarm"), L(farms.map((farm) => farm.farm_name))]) };
  const farm = pick(choice, farms);
  return farm ? { farm } : { screen: invalid(`${id}.farm`) };
}

// ---------------------------------------------------------------------------
// 1. Farm activities
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

async function activityFlow(a, ctx, start) {
  const { farm, screen } = await chooseFarm(a, ctx.farmer, "activity");
  if (screen) return screen;
  const choice = a.next();
  if (choice === undefined) return ask("activity.what", [P("activity.what"), L(WORK_LABELS)]);
  const work = pick(choice, WORK);
  if (!work) return invalid("activity.what");
  const when = askDate(a, "activity");
  if (when.screen) return when.screen;
  // A short note can be typed on USSD; a phone keypad can't type words.
  let note = "";
  if (ctx.channel === "ussd") {
    const typed = a.next();
    if (typed === undefined) return ask("activity.note", [P("activity.note")], { kind: "text" });
    note = typed === "0" ? "" : typed.slice(0, 200);
  }
  const words = { work: work[0], farm: farm.farm_name, day: dayWords(when.date) };
  return confirm(a, "activity", [P("activity.confirm", words)], async () => {
    await ctx.once(`save:${start}`, () =>
      createActivity(ctx.farmer.id, {
        clientId: `${ctx.channel}-${ctx.sessionKey}-${start}`.slice(0, 100),
        farmId: farm.id,
        activityType: work[1],
        activityDate: when.date,
        notes: [`Recorded by ${ctx.channelName}`, note].filter(Boolean).join(": ")
      })
    );
    return done("activity.saved", [P("activity.saved", words)]);
  });
}

// ---------------------------------------------------------------------------
// 2. Harvest
// ---------------------------------------------------------------------------

export const UNITS = [
  ["Bags", "bags"],
  ["Kilo", "kg"],
  ["Buckets", "buckets"],
  ["Tins", "tins"],
  ["Bunches", "bunches"],
  ["Pieces", "pieces"],
  ["Birds", "birds"],
  ["Eggs", "eggs"],
  ["Litres", "litres"]
];
const unitWord = (unit) => (UNITS.find(([, value]) => value === unit)?.[0] || unit).toLowerCase();
const ONE = { bags: "bag", kg: "kilo", buckets: "bucket", tins: "tin", bunches: "bunch", pieces: "piece", birds: "bird", eggs: "egg", litres: "litre" };
const unitOne = (unit) => ONE[unit] || unitWord(unit);

function cropsOf(farm) {
  const crops = [...(farm.crops || [])];
  for (const product of ANIMAL_PRODUCTS) {
    if (!crops.some((crop) => crop.toLowerCase() === product.toLowerCase()) && farmYields(farm, product)) crops.push(product);
  }
  return crops.slice(0, 8);
}

async function harvestFlow(a, ctx, start) {
  const { farm, screen } = await chooseFarm(a, ctx.farmer, "harvest");
  if (screen) return screen;
  const crops = cropsOf(farm);
  if (!crops.length) return done("harvest.nocrop", [P("harvest.noCrop")]);
  const cropChoice = a.next();
  if (cropChoice === undefined) return ask("harvest.crop", [P("harvest.crop"), L(crops)]);
  const crop = pick(cropChoice, crops);
  if (!crop) return invalid("harvest.crop");
  const typed = a.next();
  if (typed === undefined) return ask("harvest.quantity", [P("harvest.quantity")], { kind: "number", maxDigits: 9 });
  const quantity = amount(typed);
  if (quantity === null) return invalid("harvest.quantity");
  const unitChoice = a.next();
  if (unitChoice === undefined) return ask("harvest.unit", [P("harvest.unit"), L(UNITS.map(([label]) => label))]);
  const unit = pick(unitChoice, UNITS);
  if (!unit) return invalid("harvest.unit");
  const when = askDate(a, "harvest");
  if (when.screen) return when.screen;
  const words = { quantity: shortPrice(quantity), unit: unitWord(unit[1]), crop, farm: farm.farm_name, day: dayWords(when.date) };
  return confirm(a, "harvest", [P("harvest.confirm", words)], async () => {
    const clientId = await farmClientId(farm);
    await ctx.once(`save:${start}`, () =>
      createRecord("harvests", ctx.farmer.id, {
        clientId: `${ctx.channel}-${ctx.sessionKey}-${start}`.slice(0, 100),
        farmClientId: clientId,
        crop,
        quantity,
        unit: unit[1],
        harvestDate: when.date,
        notes: `Recorded by ${ctx.channelName}`
      })
    );
    return done("harvest.saved", [P("harvest.saved", words)]);
  });
}

// ---------------------------------------------------------------------------
// 3. Sales (from a harvest, with payment and an optional cost)
// ---------------------------------------------------------------------------

async function harvestsWithStock(farmer) {
  const { rows } = await query(
    `SELECT h.id, h.client_id, h.crop, h.unit, h.harvest_date, h.farm_id, h.farm_client_id,
       h.quantity - COALESCE(sold.total, 0) AS left
     FROM harvests h
     LEFT JOIN LATERAL (
       SELECT sum(quantity) AS total FROM sales WHERE harvest_id = h.id AND deleted_at IS NULL
     ) sold ON true
     WHERE h.farmer_id = $1 AND h.deleted_at IS NULL AND h.quantity - COALESCE(sold.total, 0) > 0
     ORDER BY h.harvest_date DESC, h.created_at DESC
     LIMIT 8`,
    [farmer.id]
  );
  return rows.map((row) => ({ ...row, left: Number(row.left) }));
}

const COST_TYPES = [
  ["Transport", "transport"],
  ["Labour", "labour"],
  ["Other", "other"]
];

async function saleFlow(a, ctx, start) {
  const harvests = await harvestsWithStock(ctx.farmer);
  if (!harvests.length) return done("sale.none", [P("sale.none")]);
  const which = a.next();
  if (which === undefined) {
    return ask("sale.which", [
      P("sale.which"),
      L(harvests.map((h) => `${h.crop} ${shortPrice(h.left)} ${unitWord(h.unit)} (${dayWords(h.harvest_date)})`))
    ]);
  }
  const harvest = pick(which, harvests);
  if (!harvest) return invalid("sale.which");
  const unit = unitWord(harvest.unit);
  const typedQuantity = a.next();
  if (typedQuantity === undefined) {
    return ask("sale.quantity", [P("sale.quantity", { unit, left: shortPrice(harvest.left) })], { kind: "number", maxDigits: 9 });
  }
  const quantity = amount(typedQuantity);
  if (quantity === null) return invalid("sale.quantity");
  if (quantity > harvest.left) return done("sale.toomany", [P("sale.tooMany", { left: shortPrice(harvest.left), unit })]);
  const typedPrice = a.next();
  if (typedPrice === undefined) return ask("sale.price", [P("sale.price", { unit: unitOne(harvest.unit) })], { kind: "number", maxDigits: 9 });
  const price = amount(typedPrice);
  if (price === null) return invalid("sale.price");
  const currencyChoice = a.next();
  if (currencyChoice === undefined) return ask("sale.currency", [P("sale.currency"), P("sale.currency.options")]);
  const currency = { 1: "LRD", 2: "USD" }[currencyChoice];
  if (!currency) return invalid("sale.currency");
  const paidChoice = a.next();
  if (paidChoice === undefined) return ask("sale.paid", [P("sale.paid"), P("sale.paid.options")]);
  if (paidChoice !== "1" && paidChoice !== "2") return invalid("sale.paid");
  const typedCost = a.next();
  if (typedCost === undefined) return ask("sale.cost", [P("sale.cost")], { kind: "number", maxDigits: 9 });
  const cost = amount(typedCost, { allowZero: true });
  if (cost === null) return invalid("sale.cost");
  let costType = null;
  if (cost > 0) {
    const typeChoice = a.next();
    if (typeChoice === undefined) return ask("sale.costType", [P("sale.costType"), P("sale.costType.options")]);
    costType = pick(typeChoice, COST_TYPES);
    if (!costType) return invalid("sale.costType");
  }

  const total = Math.round(quantity * price * 100) / 100;
  const words = {
    quantity: shortPrice(quantity),
    unit,
    crop: harvest.crop,
    price: money(price, currency),
    total: money(total, currency),
    paid: paidChoice === "1" ? "Paid. " : "Not paid yet. ",
    cost: cost > 0 ? `Cost ${money(cost, currency)}. ` : ""
  };
  return confirm(a, "sale", [P("sale.confirm", words)], async () => {
    const base = `${ctx.channel}-${ctx.sessionKey}-${start}`.slice(0, 90);
    const date = dateOnly(0);
    await ctx.once(`save:${start}`, async () => {
      await createRecord("sales", ctx.farmer.id, {
        clientId: `${base}-sale`,
        harvestClientId: harvest.client_id,
        saleDate: date,
        quantity,
        unitPrice: price,
        totalAmount: total,
        currency,
        notes: `Recorded by ${ctx.channelName}`
      });
      if (paidChoice === "1") {
        await createRecord("payments", ctx.farmer.id, {
          clientId: `${base}-paid`,
          saleClientId: `${base}-sale`,
          amount: total,
          paidDate: date,
          method: "cash"
        });
      }
      if (cost > 0) {
        await createRecord("expenses", ctx.farmer.id, {
          clientId: `${base}-cost`,
          harvestClientId: harvest.client_id,
          expenseDate: date,
          category: costType[1],
          amount: cost,
          currency,
          notes: `Cost of a sale, recorded by ${ctx.channelName}`
        });
      }
    });
    return done("sale.saved", [P("sale.saved", words)]);
  });
}

// ---------------------------------------------------------------------------
// 4. Farm summary (the same totals as the app's Money and Report pages)
// ---------------------------------------------------------------------------

async function moneyParts(farmer) {
  const totals = await moneyAndHarvestTotals(farmer.id, {});
  const parts = [];
  for (const currency of ["LRD", "USD"]) {
    const income = totals.money.received[currency] || 0;
    const expenses = totals.money.spent[currency] || 0;
    if (!income && !expenses) continue;
    parts.push(
      P("summary.money", {
        currency: currency === "LRD" ? "Liberian dollars" : "US dollars",
        income: money(income, currency),
        expenses: money(expenses, currency),
        profit: money(totals.money.profit[currency] || 0, currency)
      })
    );
  }
  return { parts: parts.length ? parts : [P("summary.noMoney")], totals };
}

function harvestPart(totals) {
  const list = totals.harvest
    .slice(0, 4)
    .map((row) => `${row.crop} ${shortPrice(row.quantity)} ${unitWord(row.unit)}`)
    .join(", ");
  return list ? P("summary.harvests", { list }) : P("summary.noHarvests");
}

async function salesPart(farmer) {
  const { rows } = await query(
    `SELECT crop, quantity, unit, total_amount, currency, sale_date FROM sales
     WHERE farmer_id = $1 AND deleted_at IS NULL ORDER BY sale_date DESC, created_at DESC LIMIT 3`,
    [farmer.id]
  );
  if (!rows.length) return P("summary.noSales");
  const list = rows
    .map((row) => `${row.crop} ${shortPrice(row.quantity)} ${unitWord(row.unit)} ${money(row.total_amount, row.currency)} (${dayWords(row.sale_date)})`)
    .join(", ");
  return P("summary.sales", { list });
}

async function summaryFlow(a, ctx) {
  // A phone call reads everything; USSD screens are short, so it asks first.
  if (ctx.channel === "voice") {
    const { parts, totals } = await moneyParts(ctx.farmer);
    return done("summary.all", [P("summary.title"), ...parts, harvestPart(totals), await salesPart(ctx.farmer)]);
  }
  const choice = a.next();
  if (choice === undefined) return ask("summary.menu", [P("summary.title"), P("summary.options")]);
  if (choice === "1") return done("summary.money", (await moneyParts(ctx.farmer)).parts);
  if (choice === "2") return done("summary.harvests", [harvestPart((await moneyParts(ctx.farmer)).totals)]);
  if (choice === "3") return done("summary.sales", [await salesPart(ctx.farmer)]);
  return invalid("summary.menu");
}

// ---------------------------------------------------------------------------
// 5. Weather, 6. Market prices, 7. Advice
// ---------------------------------------------------------------------------

function rainWords(day) {
  if (day.rainMm >= 30) return "heavy rain";
  if (day.rainMm >= 5 || (day.rainChance ?? 0) >= 70) return "rain";
  if (day.rainMm >= 1 || (day.rainChance ?? 0) >= 40) return "maybe rain";
  return "dry";
}

async function weatherScreen(county, ctx) {
  try {
    const weather = await getCountyWeather(county);
    const [today, tomorrow] = weather.days;
    const rain = (day) => (day.rainMm >= 1 ? `, ${Math.round(day.rainMm)} mm rain` : "");
    let text = `${county} today: ${rainWords(today)}${rain(today)}, ${today.tempMin}C to ${today.tempMax}C.`;
    if (tomorrow) text += ` Tomorrow: ${rainWords(tomorrow)}${rain(tomorrow)}, up to ${tomorrow.tempMax}C.`;
    if (ctx.channel === "voice" && weather.days[2]) {
      text += ` Next day: ${rainWords(weather.days[2])}, up to ${weather.days[2].tempMax}C.`;
    }
    const tip = weather.tips[0]?.text;
    return done("weather", [T(text), ...(tip ? [T(tip)] : [])]);
  } catch {
    return done("weather.none", [P("weather.none")]);
  }
}

async function farmCounty(farmer) {
  const { rows } = await query("SELECT county FROM farms WHERE farmer_id = $1 ORDER BY created_at LIMIT 1", [farmer.id]);
  return rows[0]?.county || farmer.county;
}

async function pricesScreen(county, ctx) {
  let data = await getMarketPrices(county ? { county } : {});
  let place = county || "Liberia";
  if (county && !data.prices.length) {
    data = await getMarketPrices({});
    place = "Liberia";
  }
  if (!data.prices.length) {
    return done("prices.none", ctx.channel === "ussd" ? [P("prices.none")] : [P("prices.none"), P("prices.noExternal")]);
  }
  const lines = data.prices
    .slice(0, ctx.channel === "voice" ? 5 : 3)
    .map((item) => `${item.crop} ${CURRENCY[item.currency] || ""}${shortPrice(item.median)}/${String(item.unit).replace(/s$/, "")}`);
  if (ctx.channel === "ussd") return done("prices", [P("prices.sourceShort", { place, days: data.days }), T(lines.join("; "))]);
  return done("prices", [P("prices.source", { place, days: data.days }), T(lines.join("; ")), P("prices.noExternal")]);
}

// Advice only from what FarmBok already knows: the weather rules for the
// farmer's county and where to get expert advice. Nothing is made up here.
async function adviceScreen(ctx) {
  const parts = [P("advice.title")];
  try {
    const weather = await getCountyWeather(await farmCounty(ctx.farmer));
    const tips = weather.tips.slice(0, 2);
    if (tips.length) for (const tip of tips) parts.push(P("advice.weather", { tip: tip.text }));
    else parts.push(P("advice.none"));
  } catch {
    parts.push(P("weather.none"));
  }
  parts.push(P("advice.extension"));
  return done("advice", parts);
}

// ---------------------------------------------------------------------------
// USSD only: notifications and weekly price SMS
// ---------------------------------------------------------------------------

async function messagesScreen(ctx, start) {
  const titles = await ctx.once(`messages:${start}`, async () => {
    await refreshReminders(ctx.farmer.id);
    const { rows } = await query(
      `SELECT id, title FROM notifications WHERE farmer_id = $1 AND read_at IS NULL
       ORDER BY created_at DESC LIMIT 3`,
      [ctx.farmer.id]
    );
    if (rows.length) {
      await query("UPDATE notifications SET read_at = now() WHERE id = ANY($1::uuid[])", [rows.map((row) => row.id)]);
    }
    return rows.map((row) => row.title);
  });
  if (!titles.length) return done("notify.none", [P("notify.none")]);
  return done("notify.messages", [L(titles)]);
}

async function priceSmsScreen(a, ctx, start) {
  // What the farmer saw when they chose, kept for the session, so a repeated
  // request does not switch it back.
  const wasOn = await ctx.once(`priceSms:${start}:seen`, async () => {
    const { rows } = await query("SELECT price_sms FROM farmers WHERE id = $1", [ctx.farmer.id]);
    return Boolean(rows[0]?.price_sms);
  });
  const choice = a.next();
  if (choice === undefined) {
    return ask(
      "notify.sms",
      wasOn ? [P("notify.sms.on"), P("notify.sms.on.options")] : [P("notify.sms.off"), P("notify.sms.off.options")]
    );
  }
  if (choice === "2") return done("notify.sms.same", [P("notify.sms.same")]);
  if (choice !== "1") return invalid("notify.sms");
  await ctx.once(`priceSms:${start}:set`, () =>
    query("UPDATE farmers SET price_sms = $1, updated_at = now() WHERE id = $2", [!wasOn, ctx.farmer.id])
  );
  return done("notify.sms.done", [P(wasOn ? "notify.sms.nowOff" : "notify.sms.nowOn")]);
}

async function notificationsFlow(a, ctx, start) {
  const choice = a.next();
  if (choice === undefined) return ask("notify.menu", [P("notify.options")]);
  if (choice === "1") return messagesScreen(ctx, start);
  if (choice === "2") return priceSmsScreen(a, ctx, start);
  return invalid("notify.menu");
}

// ---------------------------------------------------------------------------
// Main menu
// ---------------------------------------------------------------------------

function mainMenu(ctx) {
  return ctx.channel === "voice"
    ? ask("menu", [P("ivr.menu.title"), P("ivr.menu.options")])
    : ask("menu", [P("ussd.welcome"), P("ussd.menu.options")]);
}

const goodbye = (ctx) =>
  done("goodbye", [P(ctx.channel === "voice" ? "ivr.goodbye" : "ussd.exit")], { final: true });

async function menuLoop(a, ctx) {
  for (;;) {
    const start = a.position;
    const choice = a.next();
    if (choice === undefined) return mainMenu(ctx);
    let result;
    if (choice === "1") result = await activityFlow(a, ctx, start);
    else if (choice === "2") result = await harvestFlow(a, ctx, start);
    else if (choice === "3") result = await saleFlow(a, ctx, start);
    else if (choice === "4") result = await summaryFlow(a, ctx);
    else if (choice === "5") result = await weatherScreen(await farmCounty(ctx.farmer), ctx);
    else if (choice === "6") result = await pricesScreen(ctx.farmer.county, ctx);
    else if (choice === "7") result = ctx.channel === "voice" ? await adviceScreen(ctx) : await notificationsFlow(a, ctx, start);
    else if (choice === "8") result = done("help", [P(ctx.channel === "voice" ? "ivr.help" : "ussd.help")]);
    else if ((ctx.channel === "voice" && choice === "9") || (ctx.channel === "ussd" && choice === "0")) return goodbye(ctx);
    else return invalid("menu");

    if (result.invalid || !result.end || ctx.channel === "ussd" || result.final) return result;
    // On a call, after hearing a result: 0 for the menu, 9 to hang up.
    const next = a.next();
    if (next === undefined) return ask(`${result.id}.after`, [...result.parts, P("ivr.after")]);
    if (next === "9") return goodbye(ctx);
    if (next !== "0") return invalid(`${result.id}.after`);
  }
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

// Checks the PIN once per session; later screens of the same session (USSD
// sends the PIN again with every screen) don't check it again.
async function checkPin(a, ctx) {
  const pin = a.next();
  if (pin === undefined) {
    const first = ctx.farmer.full_name.split(/\s+/)[0];
    return ctx.channel === "voice"
      ? ask("pin", [P("ivr.hello", { name: first }), P("ivr.pin")], { kind: "pin", finishOnKey: "#" })
      : ask("pin", [P("ussd.hello", { name: first }), P("ussd.pin")], { kind: "pin" });
  }
  ctx.pinPositions.push(a.position - 1);
  if (ctx.authenticated) return null;
  try {
    assertNotLocked(ctx.farmer, "login");
  } catch {
    return done("pin.locked", [P("auth.locked")], { final: true });
  }
  if (!(await verifyPin(pin, ctx.farmer.pin_hash))) {
    const until = await recordFailure("farmer", ctx.farmer.id, "login");
    const locked = until && new Date(until).getTime() > Date.now();
    return done(locked ? "pin.locked" : "pin.wrong", [P(locked ? "auth.locked" : "auth.wrongPin")], { final: true });
  }
  if (ctx.farmer.failed_login_count > 0 || ctx.farmer.locked_until) await clearFailures("farmer", ctx.farmer.id, ["login"]);
  if (ctx.farmer.status !== "active") return done("pin.inactive", [P("auth.inactive")], { final: true });
  ctx.authenticated = true;
  return null;
}

// Counties take two screens: 1-8, then 9 for the rest.
function askCounty(a, titleKey, id) {
  const first = COUNTIES.slice(0, 8);
  const rest = COUNTIES.slice(8);
  const page1 = a.next();
  if (page1 === undefined) return { screen: ask(id, [P(titleKey), L(first), P("register.more")]) };
  if (page1 === "9") {
    const page2 = a.next();
    if (page2 === undefined) return { screen: ask(`${id}.more`, [P(titleKey), L(rest)]) };
    const county = pick(page2, rest);
    return county ? { county } : { screen: invalid(`${id}.more`) };
  }
  const county = pick(page1, first);
  return county ? { county } : { screen: invalid(id) };
}

async function newFarmerUssd(a, ctx) {
  const choice = a.next();
  if (choice === undefined) return ask("welcome", [P("ussd.welcome"), P("ussd.newFarmer.options")]);
  if (choice === "2") {
    const { county, screen } = askCounty(a, "register.weatherCounty", "weather.county");
    return screen || weatherScreen(county, ctx);
  }
  if (choice === "3") return pricesScreen(null, ctx);
  if (choice === "4") return done("help", [P("ussd.help")]);
  if (choice !== "1") return invalid("welcome");

  const name = a.next();
  if (name === undefined) return ask("register.name", [P("register.name")], { kind: "text" });
  if (name.length < 2) return done("register.shortName", [P("register.shortName")]);
  const { county, screen } = askCounty(a, "register.county", "register.county");
  if (screen) return screen;
  const district = a.next();
  if (district === undefined) return ask("register.district", [P("register.district")], { kind: "text" });
  const community = a.next();
  if (community === undefined) return ask("register.community", [P("register.community")], { kind: "text" });
  const pin = a.next();
  if (pin === undefined) return ask("register.pin", [P("register.pin")], { kind: "pin" });
  ctx.pinPositions.push(a.position - 1);
  if (!/^\d{4,6}$/.test(pin)) return done("register.badPin", [P("register.badPin")]);
  const again = a.next();
  if (again === undefined) return ask("register.pinAgain", [P("register.pinAgain")], { kind: "pin" });
  ctx.pinPositions.push(a.position - 1);
  if (again !== pin) return done("register.pinMismatch", [P("register.pinMismatch")]);
  try {
    await ctx.once("register", () =>
      registerFarmer({ fullName: name, phoneNumber: ctx.phone, county, district, community, pin, confirmPin: again })
    );
  } catch (error) {
    if (error instanceof ApiError) return done("register.error", [T(error.message)]);
    throw error;
  }
  return done("register.done", [P("register.done", { name: name.split(/\s+/)[0] })]);
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

// ctx: { channel: "ussd" | "voice", channelName, phone, farmer (row or null),
//        authenticated, sessionKey, once(key, fn), pinPositions: [] }
export async function runUssd(a, ctx) {
  if (!ctx.farmer) return newFarmerUssd(a, ctx);
  const stop = await checkPin(a, ctx);
  if (stop) return stop;
  return menuLoop(a, ctx);
}

// The voice menu: language, PIN, then the menu. Sets ctx.language.
export async function runVoice(a, ctx) {
  const languageChoice = a.next();
  if (languageChoice === undefined) return ask("language", [P("ivr.welcome"), P("ivr.languages")]);
  const language = pick(languageChoice, VOICE_LANGUAGES);
  if (!language) return invalid("language");
  ctx.language = language.code;
  if (!ctx.farmer) return done("unknown", [P("ivr.unknownCaller")], { final: true });
  const stop = await checkPin(a, ctx);
  if (stop) return stop;
  if (ctx.farmer.preferred_language !== language.code) {
    await ctx.once("language", () =>
      query("UPDATE farmers SET preferred_language = $1, updated_at = now() WHERE id = $2", [language.code, ctx.farmer.id])
    );
  }
  return menuLoop(a, ctx);
}

// Every screen id with a fixed list of prompt keys, for documentation.
export const MAIN_MENUS = {
  ussd: ["1 Farm Activities", "2 Record Harvest", "3 Record Sales", "4 Farm Summary", "5 Weather Information", "6 Market Prices", "7 Notifications", "8 Help", "0 Exit"],
  voice: ["1 Farm activities", "2 Record harvest", "3 Record sale", "4 Farm summary", "5 Weather", "6 Market prices", "7 Farm advice", "8 Help", "9 End call"]
};
