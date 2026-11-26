import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Recorded voice prompts for the voice menu (IVR).
//
// One audio file per prompt key and language:
//   backend/voice-clips/<language>/<prompt key>.mp3   (or .wav)
// for example voice-clips/en/ivr.menu.title.mp3. When a recording exists it
// is played; otherwise the words are read by a computer voice (English only)
// and marked as a fallback. `npm run voice:script` lists what to record.

export const CLIPS_DIR =
  process.env.VOICE_CLIPS_DIR ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../voice-clips");

const TYPES = { ".mp3": "audio/mpeg", ".wav": "audio/wav" };
const LANGUAGE = /^[a-z]{2,12}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9.]{0,80}\.(mp3|wav)$/;
const SCAN_MS = 60 * 1000;
let cache = { at: 0, byLanguage: new Map() };

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
      if (!FILE.test(file)) continue;
      const ext = path.extname(file).toLowerCase();
      const key = file.slice(0, -ext.length);
      // An .mp3 wins over a .wav of the same prompt: it is smaller.
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

// The file name of the recording of this prompt in this language, or null.
export function findClip(key, language) {
  return clipsFor(language).get(key) || null;
}

// Path and content type for serving a clip, or null for anything else.
export function clipFile(language, file) {
  if (!LANGUAGE.test(String(language)) || !FILE.test(String(file))) return null;
  const key = file.replace(/\.(mp3|wav)$/, "");
  if (clipsFor(language).get(key) !== file) return null;
  return { path: path.join(CLIPS_DIR, language, file), type: TYPES[path.extname(file)] };
}

// Forget the scanned folders (after clips are added, and in tests).
export function resetClipCache() {
  cache = { at: 0, byLanguage: new Map() };
}
