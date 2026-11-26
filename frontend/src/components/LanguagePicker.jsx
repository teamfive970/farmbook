import { Check, Languages, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { api } from "../lib/api.js";
import { LANGUAGES, availablePacks, currentLanguage, setLanguage } from "../lib/i18n.js";

// Choose the language for the words on screen. Languages whose word pack is
// not ready yet are shown as "coming", so farmers and partners know they are
// planned and can help translate.
export default function LanguagePicker({ compact = false }) {
  const [packs, setPacks] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const current = currentLanguage();
  const { token, user } = useAuth();

  useEffect(() => {
    availablePacks().then(setPacks);
  }, []);

  async function choose(code) {
    if (code === current) return;
    setBusy(code);
    setError("");
    try {
      // Kept on the farmer's account too, so the voice menu and USSD know it.
      // Best effort: offline, the app still changes language.
      if (token && user?.role === "farmer") {
        await api.put("/api/auth/language", { language: code }, { token }).catch(() => {});
      }
      await setLanguage(code);
    } catch (problem) {
      setError(problem.message || "Could not change the language. Try again with network.");
      setBusy("");
    }
  }

  const ready = LANGUAGES.filter((lang) => lang.code === "en" || packs[lang.code]?.words > 0);
  const coming = LANGUAGES.filter((lang) => lang.code !== "en" && !(packs[lang.code]?.words > 0));

  return (
    <div>
      <p className="label flex items-center gap-2" data-say="Choose your language.">
        <Languages size={16} aria-hidden="true" /> Language
      </p>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {ready.map((lang) => {
          const selected = lang.code === current;
          const pack = packs[lang.code];
          return (
            <button
              key={lang.code}
              type="button"
              aria-pressed={selected}
              disabled={Boolean(busy)}
              onClick={() => choose(lang.code)}
              data-say={`${lang.name}.`}
              className={`flex min-h-14 items-center justify-between gap-2 rounded-xl border-2 px-3 text-left transition ${
                selected ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white text-ink"
              }`}
            >
              <span>
                <span className="block text-sm font-bold">{lang.name}</span>
                <span className="block text-[11px] text-ink-soft">
                  {lang.code === "en" ? lang.native : pack?.percent < 100 ? `${pack.percent}% of words, the rest in English` : "All words"}
                </span>
              </span>
              {busy === lang.code ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                selected && <Check size={18} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
      {coming.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          Coming when native speakers have checked the words: {coming.map((lang) => lang.name).join(", ")}. Words not yet
          translated stay in English. Want to help? Ask your extension officer or the FarmBok team.
        </p>
      )}
    </div>
  );
}
