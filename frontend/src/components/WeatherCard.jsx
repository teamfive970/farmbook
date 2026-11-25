import { ChevronRight, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { dayName, rainWords, sayForecast, useWeather } from "../lib/weather.js";
import WeatherIcon from "./WeatherIcon.jsx";

const TIP_TONE = {
  warning: "bg-amber-50 text-amber-900",
  good: "bg-emerald-50 text-emerald-900",
  info: "bg-sky-50 text-sky-900"
};

// Small weather card for the Home screen: today, the next two days and the
// first farm tip. Touch it for the full week.
export default function WeatherCard({ county, className = "" }) {
  const { data, loading, offline } = useWeather(county);
  if (!county) return null;

  if (!data) {
    return (
      <Link to="/app/weather" className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ${className}`}>
        <WeatherIcon kind="partly" size={28} />
        <span className="flex-1 text-sm font-semibold text-ink">
          {loading ? "Getting the weather…" : offline ? "Weather needs network the first time." : "Weather"}
        </span>
        <ChevronRight size={18} className="text-ink-soft" aria-hidden="true" />
      </Link>
    );
  }

  const [today, ...rest] = data.days;
  const tip = data.tips?.[0];
  return (
    <Link
      to="/app/weather"
      data-say={sayForecast(data)}
      className={`block rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50">
          <WeatherIcon kind={data.current?.kind || today.kind} size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-soft">Weather · {data.county}</p>
          <p className="text-xl font-bold leading-tight text-ink">{data.current?.temp ?? today.tempMax}°C</p>
          <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
            <Droplets size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{data.current?.text || today.text} · {rainWords(today)}</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          {rest.slice(0, 2).map((day, index) => (
            <span key={day.date} className="flex w-12 flex-col items-center rounded-xl bg-canvas py-1.5">
              <span className="text-[10px] font-bold text-ink-soft">{index === 0 ? "Tmrw" : dayName(day.date, index + 1)}</span>
              <WeatherIcon kind={day.kind} size={18} />
              <span className="text-[11px] font-bold text-ink">{day.tempMax}°</span>
            </span>
          ))}
        </div>
      </div>
      {tip && <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold leading-snug ${TIP_TONE[tip.level]}`}>{tip.text}</p>}
    </Link>
  );
}
