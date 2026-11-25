import { CircleAlert, CloudOff, Droplets, Leaf, RefreshCw, Sprout, Thermometer, Wind } from "lucide-react";
import { useState } from "react";
import WeatherIcon from "../../components/WeatherIcon.jsx";
import { SpeakButton, useSpeakOnOpen } from "../../components/Voice.jsx";
import { ErrorBanner, PageHeader, Select } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { COUNTIES } from "../../lib/labels.js";
import { dayName, rainWords, sayForecast, updatedWords, useWeather } from "../../lib/weather.js";
import { WORDS } from "../../lib/words.js";

const TIP_STYLE = {
  warning: ["bg-amber-50 text-amber-900 border-amber-200", CircleAlert],
  good: ["bg-emerald-50 text-emerald-900 border-emerald-200", Sprout],
  info: ["bg-sky-50 text-sky-900 border-sky-200", Leaf]
};

// The week's weather for the farmer's county, with simple farm advice.
export default function Weather() {
  const { user } = useAuth();
  const { farms } = useFarmerData();
  const farmCounties = [...new Set(farms.map((farm) => farm.county).filter(Boolean))];
  const [county, setCounty] = useState(farmCounties[0] || user?.county || "Montserrado");
  const { data, savedAt, loading, error, offline, reload } = useWeather(county);
  useSpeakOnOpen(WORDS.weatherTitle);

  const choices = [...new Set([...farmCounties, ...COUNTIES])];

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-4xl">
      <PageHeader title={WORDS.weatherTitle.text} subtitle="Rain, sun and farm advice for your county." say={WORDS.weatherTitle} backTo="/app" />

      <div className="flex items-end gap-2">
        <label className="flex-1" htmlFor="weather-county">
          <span className="label">Where</span>
          <Select id="weather-county" value={county} onChange={(event) => setCounty(event.target.value)}>
            {choices.map((item) => (
              <option key={item} value={item}>
                {item} County{farmCounties.includes(item) ? " (my farm)" : ""}
              </option>
            ))}
          </Select>
        </label>
        {data && <SpeakButton phrase={{ say: sayForecast(data) }} />}
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label="Get the newest weather"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-card disabled:opacity-60"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>

      <ErrorBanner message={error} />
      {offline && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-say="No network. This is the last weather saved on your phone.">
          <CloudOff size={16} aria-hidden="true" />
          {data ? "No network. Showing the last weather saved on your phone." : "No network. Weather needs the internet the first time."}
        </p>
      )}
      {!data && loading && <p className="py-10 text-center text-sm text-ink-soft">Getting the weather…</p>}

      {data && (
        <>
          {/* Today */}
          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 to-sky-800 p-5 text-white shadow-float">
            <p className="text-xs font-bold uppercase tracking-wide text-white/75">
              Now · {data.town}, {data.county} County
            </p>
            <div className="mt-2 flex items-center gap-4">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/90">
                <WeatherIcon kind={data.current?.kind || data.days[0].kind} size={48} />
              </span>
              <div>
                <p className="text-5xl font-extrabold leading-none">{data.current?.temp ?? data.days[0].tempMax}°C</p>
                <p className="mt-1 text-lg font-semibold">{data.current?.text || data.days[0].text}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-2">
                <Droplets size={16} aria-hidden="true" /> {rainWords(data.days[0])}
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-2">
                <Thermometer size={16} aria-hidden="true" /> {data.days[0].tempMin}°–{data.days[0].tempMax}°
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-2">
                <Wind size={16} aria-hidden="true" /> {data.current?.wind ?? data.days[0].windMax} km/h
              </span>
            </div>
          </section>

          {/* Farm advice */}
          <section>
            <h2 className="mb-2 text-base font-bold text-ink">What to do on your farm</h2>
            <ul className="space-y-2">
              {data.tips.map((tip) => {
                const [tone, Icon] = TIP_STYLE[tip.level] || TIP_STYLE.info;
                return (
                  <li key={tip.key} className={`flex items-start gap-3 rounded-2xl border p-3.5 ${tone}`} data-say={tip.say}>
                    <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-sm font-semibold leading-snug">{tip.text}</span>
                    <SpeakButton phrase={{ say: tip.say }} className="h-8 w-8 bg-white/70" />
                  </li>
                );
              })}
            </ul>
          </section>

          {/* The week */}
          <section>
            <h2 className="mb-2 text-base font-bold text-ink">This week</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white shadow-card">
              {data.days.map((day, index) => (
                <li
                  key={day.date}
                  className="flex items-center gap-3 px-4 py-3"
                  data-say={`${dayName(day.date, index, true)}: ${day.text}. ${rainWords(day)}. Up to ${day.tempMax} degrees.`}
                >
                  <span className="w-20 text-sm font-bold text-ink">{dayName(day.date, index, true)}</span>
                  <WeatherIcon kind={day.kind} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{day.text}</span>
                    <span className="block text-xs text-ink-soft">
                      {rainWords(day)}
                      {day.rainMm > 0 ? ` · ${day.rainMm} mm` : ""}
                      {day.rainChance !== null ? ` · ${day.rainChance}% chance` : ""}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="font-bold text-ink">{day.tempMax}°</span>
                    <span className="text-ink-soft"> / {day.tempMin}°</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-center text-xs text-ink-soft">
            {updatedWords(savedAt)}
            {data.stale ? " · weather service was slow, this may be old" : ""} · Forecast for {data.town} from{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">
              Open-Meteo
            </a>
          </p>
        </>
      )}
    </div>
  );
}
