import { CircleAlert, CloudOff, Info, RefreshCw, Sparkles, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SpeakButton, useSpeakOnOpen } from "../../components/Voice.jsx";
import { ErrorBanner, PageHeader } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { WORDS } from "../../lib/words.js";

const TONE = {
  good: ["border-emerald-200 bg-emerald-50 text-emerald-950", ThumbsUp, "text-emerald-700"],
  warning: ["border-amber-200 bg-amber-50 text-amber-950", CircleAlert, "text-amber-700"],
  info: ["border-line bg-white text-ink", Info, "text-sky-700"]
};

const KEY = (userId) => `farmbok.insights.${userId}`;

function readSaved(userId) {
  try {
    return JSON.parse(localStorage.getItem(KEY(userId)) || "null");
  } catch {
    return null;
  }
}

// "My farm insights": what changed this season, worked out from the
// farmer's records on the server. The last answer stays on the phone.
export default function Insights() {
  const { user, token } = useAuth();
  const { online, pendingCount: pending } = useSync();
  const [data, setData] = useState(() => readSaved(user?.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useSpeakOnOpen(WORDS.insightsTitle);

  const load = useCallback(async () => {
    if (!online || !token) return;
    setLoading(true);
    setError("");
    try {
      const next = await api.get("/api/insights", { token });
      setData(next);
      try {
        localStorage.setItem(KEY(user?.id), JSON.stringify(next));
      } catch {
        // Storage full: the page still shows the answer.
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [online, token, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const sayAll = data
    ? [data.summary?.text, ...data.insights.map((item) => item.say)].filter(Boolean).join(" ")
    : "";

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-3xl">
      <PageHeader
        title={WORDS.insightsTitle.text}
        subtitle="What changed on your farm this season, from your own records."
        say={WORDS.insightsTitle}
        backTo="/app/money"
      />

      <div className="flex flex-wrap items-center gap-2">
        {data && <SpeakButton phrase={{ say: sayAll }} />}
        <button
          type="button"
          onClick={load}
          disabled={loading || !online}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-primary shadow-card disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          {loading ? "Looking at your records…" : "Look again"}
        </button>
        {data?.generatedAt && <span className="text-xs text-ink-soft">Updated {formatDate(data.generatedAt)}</span>}
      </div>

      {!online && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          <CloudOff size={16} aria-hidden="true" />
          {data ? "No network. This is the last look saved on your phone." : "Insights need network the first time."}
        </p>
      )}
      {pending > 0 && online && (
        <p className="text-xs text-ink-soft">Some records are still being sent. Look again after they are sent.</p>
      )}
      <ErrorBanner message={error} />

      {data?.summary?.text && (
        <section className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white shadow-float" data-say={data.summary.text}>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/80">
            <Sparkles size={14} aria-hidden="true" /> Summary
          </p>
          <p className="mt-2 text-base leading-relaxed">{data.summary.text}</p>
          <p className="mt-3 text-[11px] text-white/70">Written by AI from your records. Check the numbers below.</p>
        </section>
      )}

      {data && (
        <ul className="space-y-2">
          {data.insights.map((item) => {
            const [tone, Icon, iconTone] = TONE[item.level] || TONE.info;
            return (
              <li key={item.key} className={`flex items-start gap-3 rounded-2xl border p-4 shadow-card ${tone}`} data-say={item.say}>
                <Icon size={20} className={`mt-0.5 shrink-0 ${iconTone}`} aria-hidden="true" />
                <span className="flex-1 text-sm font-semibold leading-relaxed">{item.text}</span>
                <SpeakButton phrase={{ say: item.say }} className="h-8 w-8 bg-white/70" />
              </li>
            );
          })}
        </ul>
      )}

      {data?.periods && (
        <p className="text-center text-xs text-ink-soft">
          This season: {formatDate(data.periods.now.from)} – {formatDate(data.periods.now.to)}. Last season:{" "}
          {formatDate(data.periods.before.from)} – {formatDate(data.periods.before.to)}. L$ and US$ are kept apart.
        </p>
      )}
    </div>
  );
}
