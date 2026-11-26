import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Recorded voice clips for the voice menu (IVR).
//
// The voice menu speaks one sentence at a time. For each sentence, FarmBok
// looks for a recording of a real person saying it and plays that instead of
// the computer voice. Sentences with no recording yet (and sentences with
// names, prices or dates in them) are still read by the computer voice, so
// clips can be added a few at a time.
//
// Clips live in backend/voice-clips/<language>/<key>.mp3 (or .wav), where the
// key comes from the English sentence (clipKey below). Run
// `npm run voice:script` to list every sentence to record with its file name.

export const CLIPS_DIR =
  process.env.VOICE_CLIPS_DIR ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../voice-clips");

const TYPES = { ".mp3": "audio/mpeg", ".wav": "audio/wav" };
const LANGUAGE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;
const SCAN_MS = 60 * 1000;
let cache = { at: 0, byLanguage: new Map() };

// The language whose clips are played: VOICE_CLIP_LANG, e.g. "en-lr" for
// Liberian English or "kpe" for Kpelle. Default: Liberian English.
export function clipLanguage() {
  const value = String(process.env.VOICE_CLIP_LANG || "en-lr").trim().toLowerCase();
  return LANGUAGE.test(value) ? value : "en-lr";
}

// Splits spoken text into sentences, the unit that gets one clip each.
export function sentences(text) {
  return String(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// "Press 1 for record farm work." -> "press-1-for-record-farm-work".
// Long sentences keep a short start and a hash, so two long sentences that
// begin the same way still get different files.
export function clipKey(sentence) {
  const plain = String(sentence)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
  if (plain.length <= 60) return plain;
  const hash = crypto.createHash("sha1").update(plain).digest("hex").slice(0, 6);
  return `${plain.slice(0, 50).replace(/-+$/, "")}-${hash}`;
}

function scan() {
  const byLanguage = new Map();
  let folders = [];
  try {
    folders = fs.readdirSync(CLIPS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    return byLanguage;
  }
  for (const folder of folders) {
    if (!LANGUAGE.test(folder.name)) continue;
    const files = new Map();
    for (const file of fs.readdirSync(path.join(CLIPS_DIR, folder.name))) {
      const ext = path.extname(file).toLowerCase();
      if (!TYPES[ext]) continue;
      const key = file.slice(0, -ext.length);
      // An .mp3 wins over a .wav of the same sentence: it is smaller.
      if (!files.has(key) || ext === ".mp3") files.set(key, file);
    }
    if (files.size) byLanguage.set(folder.name, files);
  }
  return byLanguage;
}

function clipsFor(language) {
  if (Date.now() - cache.at > SCAN_MS) cache = { at: Date.now(), byLanguage: scan() };
  return cache.byLanguage.get(language) || new Map();
}

// The file name of the recording of this sentence, or null.
export function findClip(sentence, language = clipLanguage()) {
  return clipsFor(language).get(clipKey(sentence)) || null;
}

// Path and content type for serving a clip, or null for anything else.
export function clipFile(language, file) {
  if (!LANGUAGE.test(String(language)) || !/^[a-z0-9-]+\.(mp3|wav)$/.test(String(file))) return null;
  const key = file.replace(/\.(mp3|wav)$/, "");
  if (clipsFor(language).get(key) !== file) return null;
  return { path: path.join(CLIPS_DIR, language, file), type: TYPES[path.extname(file)] };
}

// Forget the scanned folders (after clips are added, and in tests).
export function resetClipCache() {
  cache = { at: 0, byLanguage: new Map() };
}
