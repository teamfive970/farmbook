import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// Weather for a county. The last answer is kept on the phone, so the farmer
// still sees the forecast when the network goes away.

const KEY = (county) => `farmbok.weather.${county}`;
const FRESH_MS = 30 * 60 * 1000;
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

function readSaved(county) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY(county)) || "null");
    if (saved && Date.now() - saved.savedAt < KEEP_MS) return saved;
  } catch {
    // Storage blocked or broken: ignore.
  }
  return null;
}

function save(county, data) {
  try {
    localStorage.setItem(KEY(county), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage full or blocked: the page still works without it.
  }
}

export function useWeather(county) {
  const [state, setState] = useState(() => {
    const saved = county ? readSaved(county) : null;
    return { data: saved?.data || null, savedAt: saved?.savedAt || null, loading: Boolean(county), error: "", offline: false };
  });

  const load = useCallback(
    async (force = false) => {
      if (!county) return;
      const saved = readSaved(county);
      if (saved) setState((s) => ({ ...s, data: saved.data, savedAt: saved.savedAt }));
      if (!force && saved && Date.now() - saved.savedAt < FRESH_MS) {
        setState((s) => ({ ...s, loading: false, error: "", offline: false }));
        return;
      }
      setState((s) => ({ ...s, loading: true }));
      try {
        const data = await api.get(`/api/weather?county=${encodeURIComponent(county)}`);
        save(county, data);
        setState({ data, savedAt: Date.now(), loading: false, error: "", offline: false });
      } catch (error) {
        setState((s) => ({
          ...s,
          loading: false,
          offline: Boolean(error.isNetworkError),
          error: error.isNetworkError ? "" : error.message || "Weather is not available right now."
        }));
      }
    },
    [county]
  );

  useEffect(() => {
    const saved = county ? readSaved(county) : null;
    setState({ data: saved?.data || null, savedAt: saved?.savedAt || null, loading: Boolean(county), error: "", offline: false });
    load();
  }, [county, load]);

  return { ...state, reload: () => load(true) };
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const LONG_DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

export function dayName(date, index, long = false) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return (long ? LONG_DAY : DAY).format(new Date(`${date}T00:00:00Z`));
}

export function rainWords(day) {
  if (day.rainMm >= 30) return "Heavy rain";
  if (day.rainMm >= 5 || (day.rainChance ?? 0) >= 70) return "Rain likely";
  if (day.rainMm >= 1 || (day.rainChance ?? 0) >= 40) return "Maybe rain";
  return "Dry";
}

export function sayForecast(data) {
  if (!data?.days?.length) return "";
  const [today, tomorrow] = data.days;
  const parts = [`Weather for ${data.county} County.`];
  parts.push(`Today: ${today.text}, ${rainWords(today).toLowerCase()}, up to ${today.tempMax} degrees.`);
  if (tomorrow) parts.push(`Tomorrow: ${tomorrow.text}, ${rainWords(tomorrow).toLowerCase()}.`);
  if (data.tips?.[0]) parts.push(data.tips[0].say);
  return parts.join(" ");
}

export function updatedWords(savedAt) {
  if (!savedAt) return "";
  const minutes = Math.round((Date.now() - savedAt) / 60000);
  if (minutes < 2) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}
