import { ACTIVE_LANGUAGE, LANGUAGE_KEY, PACK_KEY } from "./i18nState.js";

// Languages of Liberia that FarmBok can show. Names are in English; the
// native-speaker team can add the name in the language itself. A language can be picked once
// its word pack exists in public/i18n/<code>.json (see public/i18n/README.md
// for how translators fill one in). Words not yet translated stay in English.

export const LANGUAGES = [
  { code: "en", name: "English", native: "Simple Liberian English" },
  { code: "kpelle", name: "Kpelle" },
  { code: "bassa", name: "Bassa" },
  { code: "dan", name: "Dan (Gio)" },
  { code: "mano", name: "Mano" },
  { code: "kru", name: "Kru (Klao)" },
  { code: "loma", name: "Loma" },
  { code: "vai", name: "Vai" },
  { code: "kissi", name: "Kissi" },
  { code: "grebo", name: "Grebo" },
  { code: "gola", name: "Gola" },
  { code: "mandingo", name: "Mandingo" },
  { code: "krahn", name: "Krahn" }
];

export const currentLanguage = () => ACTIVE_LANGUAGE.code;

// public/i18n/index.json: which packs exist and how many words they have.
export async function availablePacks() {
  try {
    const response = await fetch("/i18n/index.json", { cache: "no-cache" });
    if (!response.ok) return {};
    const data = await response.json();
    return data?.packs || {};
  } catch {
    return {};
  }
}

// Downloads the pack, keeps it on the phone, and restarts the app in it.
export async function setLanguage(code) {
  if (code !== "en") {
    const response = await fetch(`/i18n/${code}.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error("This language is not ready yet.");
    const pack = await response.json();
    localStorage.setItem(PACK_KEY(code), JSON.stringify(pack));
  }
  localStorage.setItem(LANGUAGE_KEY, code);
  window.location.reload();
}

// Gets a newer pack in the background, used the next time the app opens.
export async function refreshLanguagePack() {
  const code = ACTIVE_LANGUAGE.code;
  if (code === "en" || typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    const response = await fetch(`/i18n/${code}.json`, { cache: "no-cache" });
    if (response.ok) localStorage.setItem(PACK_KEY(code), JSON.stringify(await response.json()));
  } catch {
    // Offline: keep the saved pack.
  }
}
