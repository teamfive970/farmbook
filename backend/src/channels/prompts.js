import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Prompt packs: every word the USSD menu and the voice menu (IVR) say, one
// file per language in backend/voice-prompts/<language>.json, keyed like
// "ivr.menu.title". English is complete; Kpelle and Bassa are waiting for
// native speakers. A prompt missing in a language falls back to English and
// is marked `missing`, so nobody mistakes it for a checked translation.

export const PROMPTS_DIR =
  process.env.VOICE_PROMPTS_DIR ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../voice-prompts");

// Languages offered on the voice menu, in the order of the language question.
export const VOICE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "kpelle", name: "Kpelle" },
  { code: "bassa", name: "Bassa" }
];
export const LANGUAGE_CODE = /^[a-z]{2,12}$/;

const packs = new Map();
function pack(language) {
  if (!LANGUAGE_CODE.test(String(language))) return {};
  if (!packs.has(language)) {
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, `${language}.json`), "utf8"));
    } catch {
      data = {};
    }
    packs.set(language, data);
  }
  return packs.get(language);
}

export function resetPromptCache() {
  packs.clear();
}

export function englishPack() {
  return pack("en");
}

function fill(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? "").toString());
}

// The words for a prompt key in a language:
// { text, language (the language the text is really in), missing }.
export function promptText(key, params = {}, language = "en") {
  const own = pack(language)[key];
  if (typeof own === "string" && own.trim()) return { text: fill(own, params), language, missing: false };
  const english = pack("en")[key];
  if (typeof english !== "string") throw new Error(`Unknown prompt: ${key}`);
  return { text: fill(english, params), language: "en", missing: language !== "en" };
}

// Every prompt key and its English words (for the recording script and tests).
export function promptKeys() {
  return Object.entries(pack("en"))
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, text]) => ({ key, text, hasParams: /\{\w+\}/.test(text) }));
}

export function packStatus(language) {
  const own = pack(language);
  const keys = promptKeys();
  const done = keys.filter(({ key }) => typeof own[key] === "string" && own[key].trim()).length;
  return { language, name: own._name || language, status: own._status || "missing", translated: done, total: keys.length };
}
