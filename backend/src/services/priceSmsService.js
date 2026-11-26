import { query } from "../config/database.js";
import { sendSms, smsAvailable } from "../lib/sms.js";
import { getMarketPrices } from "./marketService.js";

// Weekly market prices by SMS, for farmers who switch it on.
//
// A few times a day the server looks for farmers whose last price text is
// at least a week old, during the day in Liberia (08:00-18:00). Prices are
// worked out once per county; a county with too few sales gets the prices for
// all of Liberia. Each farmer also gets the same text in the app inbox.
// If there are no prices at all, nothing is sent.

const CURRENCY = { LRD: "L$", USD: "US$" };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SLACK_MS = 12 * 60 * 60 * 1000; // so the day of the week stays about the same
const batchLimit = () => Number(process.env.PRICE_SMS_LIMIT || 2000);

function unitWord(unit) {
  return String(unit || "").replace(/s$/, "");
}

export function priceText(place, data, max = 5) {
  const lines = data.prices
    .slice(0, max)
    .map((item) => `${item.crop} ${CURRENCY[item.currency] || ""}${Math.round(item.median).toLocaleString("en-US")}/${unitWord(item.unit)}`);
  return `FarmBok prices, ${place} (last ${data.days} days): ${lines.join(", ")}. Sell for a fair price!`;
}

// The week number in Liberia time, used so the inbox gets one copy per week.
function weekKey(date = new Date()) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function pricesFor(county, cache) {
  if (!cache.has(county)) {
    let data = await getMarketPrices({ county });
    let place = `${county} County`;
    if (!data.prices.length) {
      if (!cache.has("*")) cache.set("*", await getMarketPrices({}));
      data = cache.get("*");
      place = "Liberia";
    }
    cache.set(county, data.prices.length ? { data, place } : null);
  }
  return cache.get(county);
}

// Sends this week's texts. `now` can be given by tests.
export async function runPriceSms({ now = new Date(), ignoreHours = false } = {}) {
  const hour = now.getUTCHours(); // Liberia is on UTC all year
  if (!ignoreHours && (hour < 8 || hour >= 18)) return { sent: 0, inbox: 0, skipped: "night" };

  const { rows: farmers } = await query(
    `SELECT id, phone_number, county FROM farmers
     WHERE price_sms AND status = 'active'
       AND (price_sms_sent_at IS NULL OR price_sms_sent_at <= $1)
     ORDER BY price_sms_sent_at NULLS FIRST, created_at
     LIMIT $2`,
    [new Date(now.getTime() - WEEK_MS + SLACK_MS), batchLimit()]
  );
  const cache = new Map();
  const key = `prices:${weekKey(now)}`;
  let sent = 0;
  let inbox = 0;
  const canSms = smsAvailable();

  for (const farmer of farmers) {
    const prices = await pricesFor(farmer.county, cache);
    if (!prices) continue;
    const text = priceText(prices.place, prices.data);
    const added = await query(
      `INSERT INTO notifications (farmer_id, kind, topic, title, body, link, dedupe_key)
       VALUES ($1, 'system', 'prices', $2, $3, '/app/prices', $4)
       ON CONFLICT (farmer_id, dedupe_key) DO NOTHING`,
      [farmer.id, `Market prices this week, ${prices.place}`, text.replace(/^FarmBok prices, [^:]+: /, ""), key]
    );
    inbox += added.rowCount;
    let delivered = !canSms;
    if (canSms) {
      try {
        await sendSms(farmer.phone_number, text);
        sent += 1;
        delivered = true;
      } catch (error) {
        console.warn(`[price-sms] could not send: ${error.message}`);
      }
    }
    // Mark as done only when delivered, so a failed SMS is tried again later.
    if (delivered) await query("UPDATE farmers SET price_sms_sent_at = $1 WHERE id = $2", [now, farmer.id]);
  }
  return { sent, inbox, farmers: farmers.length };
}

// Checks every few hours. Off when PRICE_SMS=off.
export function startPriceSms() {
  if (process.env.PRICE_SMS === "off") return null;
  const hours = Math.max(Number(process.env.PRICE_SMS_CHECK_HOURS || 3), 1);
  const run = () =>
    runPriceSms()
      .then((result) => result.farmers && console.log("[price-sms]", JSON.stringify(result)))
      .catch((error) => console.warn("[price-sms] failed:", error.message));
  const first = setTimeout(run, 90_000);
  const timer = setInterval(run, hours * 60 * 60 * 1000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
