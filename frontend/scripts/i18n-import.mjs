// Turns a filled-in translation sheet into the word pack the app downloads.
//
//   node scripts/i18n-import.mjs kpelle translations/kpelle.csv "Reviewed by: name, date"
//
// Writes public/i18n/kpelle.json, updates public/i18n/index.json, and lists
// any recorded clips found in public/audio/kpelle/ (files named like
// welcome.title.mp3) in public/audio/kpelle/manifest.json.
import fs from "node:fs";
import path from "node:path";
import { AUDIO_DIR, PACK_DIR, parseCsv, readPhrases } from "./i18n-shared.mjs";

const [code, csvFile, reviewedBy = ""] = process.argv.slice(2);
if (!code || !/^[a-z]+$/.test(code) || !csvFile) {
  console.error('Usage: node scripts/i18n-import.mjs <code> <file.csv> ["Reviewed by: ..."]');
  process.exit(1);
}

const known = new Set(readPhrases().map((phrase) => phrase.key));
const [header, ...rows] = parseCsv(fs.readFileSync(csvFile, "utf8"));
const col = (name) => header.findIndex((title) => title.trim().toLowerCase().startsWith(name));
const keyCol = col("key");
const textCol = col("translation");
const sayCol = col("spoken");
if (keyCol < 0 || textCol < 0) {
  console.error('The sheet needs a "key" column and a "translation" column.');
  process.exit(1);
}

const words = {};
const unknown = [];
for (const row of rows) {
  const key = (row[keyCol] || "").trim();
  const text = (row[textCol] || "").trim();
  if (!key || !text) continue;
  if (!known.has(key)) {
    unknown.push(key);
    continue;
  }
  const say = sayCol >= 0 ? (row[sayCol] || "").trim() : "";
  words[key] = say ? { text, say } : { text };
}

fs.mkdirSync(PACK_DIR, { recursive: true });
const pack = { language: code, reviewedBy, updatedAt: new Date().toISOString().slice(0, 10), words };
fs.writeFileSync(path.join(PACK_DIR, `${code}.json`), JSON.stringify(pack, null, 2) + "\n");

// Recorded clips: public/audio/<code>/<key>.mp3 (or .m4a, .ogg, .wav)
const clipDir = path.join(AUDIO_DIR, code);
let clipCount = 0;
if (fs.existsSync(clipDir)) {
  const clips = {};
  for (const file of fs.readdirSync(clipDir)) {
    const match = file.match(/^(.+)\.(mp3|m4a|ogg|wav)$/i);
    if (match && known.has(match[1])) clips[match[1]] = file;
  }
  clipCount = Object.keys(clips).length;
  fs.writeFileSync(path.join(clipDir, "manifest.json"), JSON.stringify({ clips }, null, 2) + "\n");
}

const indexFile = path.join(PACK_DIR, "index.json");
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : { packs: {} };
const count = Object.keys(words).length;
index.total = known.size;
index.packs = { ...(index.packs || {}), [code]: { words: count, percent: Math.floor((count / known.size) * 100), clips: clipCount, reviewedBy, updatedAt: pack.updatedAt } };
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n");

console.log(`${code}: ${count} of ${known.size} phrases translated, ${clipCount} recorded clips.`);
if (unknown.length) console.log(`Skipped ${unknown.length} rows with keys the app does not use: ${unknown.slice(0, 5).join(", ")}…`);
