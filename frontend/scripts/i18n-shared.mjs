// Shared by i18n-export.mjs and i18n-import.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WORDS_FILE = path.join(ROOT, "src/lib/words.js");
export const PACK_DIR = path.join(ROOT, "public/i18n");
export const AUDIO_DIR = path.join(ROOT, "public/audio");
export const KIT_DIR = path.join(ROOT, "translations");

const STRING = String.raw`"((?:[^"\\]|\\.)*)"`;
const PHRASE = new RegExp(String.raw`\bw\(\s*"([a-z0-9_.-]+)"\s*,\s*${STRING}(?:\s*,\s*${STRING})?\s*\)`, "gi");

const unescape = (text) => (text === undefined ? undefined : JSON.parse(`"${text}"`));

// Every phrase in words.js that has a key: [{ key, text, say }].
export function readPhrases() {
  const source = fs.readFileSync(WORDS_FILE, "utf8");
  const seen = new Map();
  for (const match of source.matchAll(PHRASE)) {
    const [, key, text, say] = match;
    if (!seen.has(key)) seen.set(key, { key, text: unescape(text), say: unescape(say) ?? unescape(text) });
  }
  return [...seen.values()];
}

// Small CSV reader/writer (Excel and Google Sheets compatible).
export function toCsv(rows) {
  const cell = (value) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}
