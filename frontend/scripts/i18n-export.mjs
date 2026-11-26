// Makes the translation sheet for one language.
//
//   node scripts/i18n-export.mjs kpelle
//
// Writes translations/kpelle.csv. Open it in Excel or Google Sheets, fill in
// the "translation" column (and optional "spoken" column), then run
// i18n-import.mjs. Words already translated are kept, so the sheet can be
// made again when new words are added to the app.
import fs from "node:fs";
import path from "node:path";
import { KIT_DIR, PACK_DIR, readPhrases, toCsv } from "./i18n-shared.mjs";

const code = process.argv[2];
if (!code || !/^[a-z]+$/.test(code)) {
  console.error("Usage: node scripts/i18n-export.mjs <language code, e.g. kpelle>");
  process.exit(1);
}

const packFile = path.join(PACK_DIR, `${code}.json`);
const existing = fs.existsSync(packFile) ? JSON.parse(fs.readFileSync(packFile, "utf8")).words || {} : {};
const phrases = readPhrases();
const rows = [["key", "english (on screen)", "english (spoken)", "translation", "spoken (optional)", "audio file name"]];
for (const phrase of phrases) {
  const done = existing[phrase.key] || {};
  rows.push([phrase.key, phrase.text, phrase.say, done.text || "", done.say || "", `${phrase.key}.mp3`]);
}
fs.mkdirSync(KIT_DIR, { recursive: true });
const out = path.join(KIT_DIR, `${code}.csv`);
fs.writeFileSync(out, toCsv(rows));
const done = phrases.filter((phrase) => existing[phrase.key]?.text).length;
console.log(`Wrote ${out}: ${phrases.length} phrases, ${done} already translated.`);
