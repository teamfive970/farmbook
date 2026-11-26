import { query } from "../config/database.js";
import { sendSms, smsAvailable } from "../lib/sms.js";
import { COUNTY_POINTS, getCountyWeather } from "./weatherService.js";

// Heavy-rain alerts. A few times a day the server looks at the forecast for
// every county that has farmers. When heavy rain is coming today or in the
// next two days, each farmer there gets one message in the app, and one SMS
// if they allow SMS. The same rain day never alerts the same farmer twice.

const LOOKAHEAD_DAYS = 3;
const heavyMm = () => Number(process.env.WEATHER_ALERT_MM || 30);
const smsLimit = () => Number(process.env.WEATHER_ALERT_SMS_LIMIT || 1000);

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

function whenText(date, index) {
  if (index === 0) return "today";
  if (index === 1) return "tomorrow";
  return `on ${DAY.format(new Date(`${date}T00:00:00Z`))}`;
}

export function findHeavyRain(days = []) {
  const limit = heavyMm();
  const index = days
    .slice(0, LOOKAHEAD_DAYS)
    .findIndex((day) => day.rainMm >= limit || day.kind === "storm" || day.kind === "heavy");
  return index === -1 ? null : { day: days[index], index };
}

export function alertMessage(county, { day, index }) {
  const when = whenText(day.date, index);
  const amount = day.rainMm >= 1 ? ` (about ${Math.round(day.rainMm)} mm)` : "";
  return {
    title: `Heavy rain ${when}`,
    body:
      `Heavy rain is coming in ${county} County ${when}${amount}. ` +
      "Clear the water ways in your swamp, keep your harvest dry and covered, and do not spray."
  };
}

// Farmers who live in the county or have a farm there.
async function farmersIn(county) {
  const { rows } = await query(
    `SELECT DISTINCT f.id FROM farmers f
     LEFT JOIN farms fm ON fm.farmer_id = f.id
     WHERE f.status = 'active' AND NOT f.is_demo AND (f.county = $1 OR fm.county = $1)`,
    [county]
  );
  return rows.map((row) => row.id);
}

async function alertCounty(county, heavy) {
  const ids = await farmersIn(county);
  if (!ids.length) return { county, farmers: 0, sms: 0 };
  const { title, body } = alertMessage(county, heavy);
  const key = `weather:heavy:${heavy.day.date}`;
  // Only rows that are new come back, so a farmer is never told twice.
  const { rows } = await query(
    `INSERT INTO notifications (farmer_id, kind, topic, title, body, link, dedupe_key)
     SELECT id, 'system', 'weather', $2, $3, '/app/weather', $4
     FROM unnest($1::uuid[]) AS id
     ON CONFLICT (farmer_id, dedupe_key) DO NOTHING
     RETURNING farmer_id`,
    [ids, title, body, key]
  );
  let sms = 0;
  if (rows.length && smsAvailable()) {
    const { rows: phones } = await query(
      `SELECT phone_number FROM farmers WHERE id = ANY($1::uuid[]) AND notify_sms ORDER BY created_at LIMIT $2`,
      [rows.map((row) => row.farmer_id), smsLimit()]
    );
    const text = `FarmBok: ${body}`;
    for (let index = 0; index < phones.length; index += 5) {
      const batch = phones.slice(index, index + 5);
      const results = await Promise.allSettled(batch.map((row) => sendSms(row.phone_number, text)));
      sms += results.filter((result) => result.status === "fulfilled").length;
    }
  }
  return { county, farmers: rows.length, sms };
}

// Looks at every county with farmers. Returns what was sent, for logs and tests.
export async function runWeatherAlerts() {
  const { rows } = await query(
    `SELECT DISTINCT county FROM (
       SELECT county FROM farmers WHERE status = 'active' AND NOT is_demo
       UNION SELECT fm.county FROM farms fm JOIN farmers f ON f.id = fm.farmer_id AND NOT f.is_demo
     ) c`
  );
  const results = [];
  for (const { county } of rows) {
    if (!COUNTY_POINTS[county]) continue;
    try {
      const weather = await getCountyWeather(county);
      const heavy = findHeavyRain(weather.days);
      if (heavy) results.push(await alertCounty(county, heavy));
    } catch (error) {
      console.warn(`[weather-alerts] ${county}: ${error.message}`);
    }
  }
  return results;
}

// Runs the check soon after start-up and then every WEATHER_ALERT_HOURS
// (default 6). Off when WEATHER_ALERTS=off or weather itself is off.
export function startWeatherAlerts() {
  if (process.env.WEATHER_ALERTS === "off" || process.env.WEATHER_PROVIDER === "off") return null;
  const hours = Math.max(Number(process.env.WEATHER_ALERT_HOURS || 6), 1);
  const run = () =>
    runWeatherAlerts()
      .then((sent) => sent.length && console.log("[weather-alerts]", JSON.stringify(sent)))
      .catch((error) => console.warn("[weather-alerts] failed:", error.message));
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, hours * 60 * 60 * 1000);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
