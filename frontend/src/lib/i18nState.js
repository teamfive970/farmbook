// The language chosen on this phone, read once when the app starts.
//
// This file must not import anything: lib/words.js reads it while it builds
// the word lists, so the chosen language is in place before any screen uses
// a word. Changing the language saves the new pack and reloads the app
// (lib/i18n.js).

export const LANGUAGE_KEY = "farmbok.language";
export const PACK_KEY = (code) => `farmbok.languagePack.${code}`;

function readActive() {
  try {
    const code = localStorage.getItem(LANGUAGE_KEY) || "en";
    if (code === "en") return { code, words: {} };
    const pack = JSON.parse(localStorage.getItem(PACK_KEY(code)) || "null");
    return { code, words: pack?.words || {} };
  } catch {
    return { code: "en", words: {} };
  }
}

export const ACTIVE_LANGUAGE = readActive();

// The words to show for a phrase key in the chosen language, or null.
export function translated(key) {
  if (!key) return null;
  const entry = ACTIVE_LANGUAGE.words[key];
  return entry && typeof entry.text === "string" && entry.text.trim() ? entry : null;
}
