import { ApiError, badRequest } from "../lib/errors.js";

// Weather for each county, with simple farm advice.
//
// The forecast comes from Open-Meteo (no API key). One request serves every
// farmer in a county, and answers are kept in memory for WEATHER_CACHE_MINUTES
// (default 30). If the weather service cannot be reached, the last answer is
// sent again (marked "stale") for up to a day, so farmers still see something.

// The county capital stands in for the whole county.
export const COUNTY_POINTS = {
  Bomi: { lat: 6.87, lon: -10.82, town: "Tubmanburg" },
  Bong: { lat: 7.0, lon: -9.47, town: "Gbarnga" },
  Gbarpolu: { lat: 7.07, lon: -10.49, town: "Bopolu" },
  "Grand Bassa": { lat: 5.88, lon: -10.05, town: "Buchanan" },
  "Grand Cape Mount": { lat: 6.75, lon: -11.37, town: "Robertsport" },
  "Grand Gedeh": { lat: 6.07, lon: -8.13, town: "Zwedru" },
  "Grand Kru": { lat: 4.67, lon: -8.23, town: "Barclayville" },
  Lofa: { lat: 8.42, lon: -9.75, town: "Voinjama" },
  Margibi: { lat: 6.53, lon: -10.35, town: "Kakata" },
  Maryland: { lat: 4.38, lon: -7.72, town: "Harper" },
  Montserrado: { lat: 6.3, lon: -10.8, town: "Monrovia" },
  Nimba: { lat: 7.36, lon: -8.71, town: "Sanniquellie" },
  "River Cess": { lat: 5.46, lon: -9.58, town: "Cestos City" },
  "River Gee": { lat: 5.2, lon: -7.88, town: "Fish Town" },
  Sinoe: { lat: 5.01, lon: -9.04, town: "Greenville" }
};

const DEFAULT_URL = "https://api.open-meteo.com/v1/forecast";
const STALE_LIMIT_MS = 24 * 60 * 60 * 1000;
const cache = new Map();
let fetcher = (url, options) => fetch(url, options);

// Tests swap in a fake weather service.
export function setWeatherFetcher(fn) {
  fetcher = fn || ((url, options) => fetch(url, options));
  cache.clear();
}

function cacheMinutes() {
  const value = Number(process.env.WEATHER_CACHE_MINUTES);
  return Number.isFinite(value) && value >= 0 ? value : 30;
}

export function findCounty(name) {
  const wanted = String(name || "").trim().toLowerCase();
  return Object.keys(COUNTY_POINTS).find((county) => county.toLowerCase() === wanted) || null;
}

// WMO weather codes grouped into a few plain words the app can show and say.
export function describeCode(code) {
  if (code === 0) return { kind: "sun", text: "Sunny" };
  if (code <= 2) return { kind: "partly", text: "Sun and cloud" };
  if (code === 3) return { kind: "cloud", text: "Cloudy" };
  if (code === 45 || code === 48) return { kind: "fog", text: "Fog" };
  if (code >= 95) return { kind: "storm", text: "Thunder and rain" };
  if ((code >= 80 && code <= 82) || (code >= 61 && code <= 67)) {
    return code === 65 || code === 82 ? { kind: "heavy", text: "Heavy rain" } : { kind: "rain", text: "Rain" };
  }
  if (code >= 51 && code <= 57) return { kind: "drizzle", text: "Light rain" };
  return { kind: "cloud", text: "Cloudy" };
}

const round = (value, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? null
    : Number(Number(value).toFixed(digits));

function shapeForecast(raw) {
  const daily = raw?.daily;
  if (!daily?.time?.length) throw new Error("Weather answer had no days");
  const days = daily.time.map((date, index) => {
    const code = Number(daily.weather_code?.[index] ?? 3);
    return {
      date,
      ...describeCode(code),
      code,
      tempMax: round(daily.temperature_2m_max?.[index]),
      tempMin: round(daily.temperature_2m_min?.[index]),
      rainMm: round(daily.precipitation_sum?.[index], 1) ?? 0,
      rainChance: round(daily.precipitation_probability_max?.[index]),
      windMax: round(daily.wind_speed_10m_max?.[index])
    };
  });
  const current = raw.current
    ? {
        ...describeCode(Number(raw.current.weather_code ?? 3)),
        temp: round(raw.current.temperature_2m),
        humidity: round(raw.current.relative_humidity_2m),
        wind: round(raw.current.wind_speed_10m),
        rainMm: round(raw.current.precipitation, 1) ?? 0
      }
    : null;
  return { current, days };
}

const isWet = (day) => day.rainMm >= 5 || (day.rainChance ?? 0) >= 70;
const isDry = (day) => day.rainMm < 1 && (day.rainChance ?? 0) < 30;

// Farm advice in simple Liberian English. Each tip has words to show and to say.
export function farmTips(days) {
  const tips = [];
  const [today, tomorrow] = days;
  if (!today) return tips;
  const nextThree = days.slice(0, 3);
  const heavy = nextThree.find((day) => day.rainMm >= 30 || day.kind === "storm" || day.kind === "heavy");
  if (heavy) {
    tips.push({
      key: "heavy_rain",
      level: "warning",
      text: "Heavy rain is coming. Clear the water ways in your swamp and keep your harvest dry and covered.",
      say: "Heavy rain is coming. Clear the water ways and keep your harvest dry."
    });
  }
  if (isWet(today) || (tomorrow && isWet(tomorrow))) {
    tips.push({
      key: "no_spray",
      level: "info",
      text: "Rain today or tomorrow. Do not spray or put fertilizer now; the rain will wash it away.",
      say: "Rain is coming. Do not spray or put fertilizer now. The rain will wash it away."
    });
  }
  const dryRun = nextThree.length === 3 && nextThree.every(isDry);
  if (dryRun) {
    tips.push({
      key: "dry_days",
      level: "good",
      text: "Dry days ahead. Good time to harvest and to dry rice, cocoa or coffee in the sun.",
      say: "Dry days are coming. Good time to harvest and to dry your rice, cocoa or coffee."
    });
  } else if (isDry(today)) {
    tips.push({
      key: "dry_today",
      level: "good",
      text: "Today looks dry. Good day to spray, weed or brush.",
      say: "Today looks dry. Good day to spray, weed or brush."
    });
  }
  const weekRain = days.slice(0, 7).reduce((sum, day) => sum + (day.rainMm || 0), 0);
  if (days.length >= 5 && weekRain < 5) {
    tips.push({
      key: "dry_week",
      level: "warning",
      text: "Very little rain this week. Water your nursery and young plants, and do not plant upland rice yet.",
      say: "Very little rain this week. Water your young plants."
    });
  }
  if ((today.tempMax ?? 0) >= 34) {
    tips.push({
      key: "heat",
      level: "info",
      text: "Very hot today. Give your animals and birds plenty of water and shade.",
      say: "Very hot today. Give your animals plenty of water and shade."
    });
  }
  if (!tips.length) {
    tips.push({
      key: "normal",
      level: "info",
      text: "Normal weather. Keep up your farm work.",
      say: "Normal weather. Keep up your farm work."
    });
  }
  return tips;
}

async function fetchForecast(point) {
  const url = new URL(process.env.WEATHER_API_URL || DEFAULT_URL);
  url.search = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lon),
    current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    timezone: "Africa/Monrovia",
    forecast_days: "7"
  }).toString();
  const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Weather service answered ${response.status}`);
  return shapeForecast(await response.json());
}

export async function getCountyWeather(countyName) {
  if (process.env.WEATHER_PROVIDER === "off") {
    throw new ApiError(503, "WEATHER_OFF", "Weather is turned off on this server.");
  }
  const county = findCounty(countyName);
  if (!county) throw badRequest("Choose a county in Liberia.", { field: "county" });
  const point = COUNTY_POINTS[county];
  const cached = cache.get(county);
  const now = Date.now();
  if (cached && now - cached.at < cacheMinutes() * 60 * 1000) return { ...cached.body, stale: false };

  try {
    const forecast = await fetchForecast(point);
    const body = {
      county,
      town: point.town,
      updatedAt: new Date(now).toISOString(),
      ...forecast,
      tips: farmTips(forecast.days),
      source: "Open-Meteo"
    };
    cache.set(county, { at: now, body });
    return { ...body, stale: false };
  } catch (error) {
    if (cached && now - cached.at < STALE_LIMIT_MS) return { ...cached.body, stale: true };
    console.warn(`[weather] ${county}: ${error.message}`);
    throw new ApiError(503, "WEATHER_UNAVAILABLE", "Weather is not available right now. Try again later.");
  }
}
