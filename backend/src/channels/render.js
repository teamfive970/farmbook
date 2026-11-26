import { findClip } from "../lib/voiceClips.js";
import { promptText } from "./prompts.js";

// Turns a menu screen (see menu.js) into what each channel needs.

// ---------------------------------------------------------------------------
// USSD: plain text, "CON " or "END ", at most 182 characters
// ---------------------------------------------------------------------------

export const USSD_MAX = 182;

function ussdLines(parts) {
  return parts.map((part) => {
    if (part.key) return { text: promptText(part.key, part.params, "en").text, fixed: !part.params };
    if (part.list) return { text: part.list.map((item, index) => `${index + 1}. ${item}`).join("\n"), fixed: true };
    return { text: part.text, fixed: false };
  });
}

export function renderUssd(screen) {
  if (screen.invalid) return `END ${promptText("common.wrong").text}`;
  const lines = ussdLines(screen.parts);
  const prefix = screen.end ? "END " : "CON ";
  let body = lines.map((line) => line.text).join("\n");
  // Too long for one screen: shorten the longest free text (names, prices)
  // and keep the choices whole.
  while (prefix.length + body.length > USSD_MAX) {
    const longest = lines.filter((line) => !line.fixed && line.text.length > 12).sort((x, y) => y.text.length - x.text.length)[0];
    if (!longest) {
      body = `${body.slice(0, USSD_MAX - prefix.length - 3)}...`;
      break;
    }
    const over = prefix.length + body.length - USSD_MAX;
    longest.text = `${longest.text.slice(0, Math.max(longest.text.length - over - 3, 9))}...`;
    body = lines.map((line) => line.text).join("\n");
  }
  return `${prefix}${body}`;
}

// ---------------------------------------------------------------------------
// Voice: a list of things to say or play
// ---------------------------------------------------------------------------

// "3,523" -> "3,523 Liberian dollars"; "0.13" -> "13 US cents";
// "2.5" -> "2 Liberian dollars and 50 cents".
function spokenMoney(amount, currency) {
  const [whole, fraction = ""] = String(amount).split(".");
  const cents = fraction ? Number(`${fraction}0`.slice(0, 2)) : 0;
  const dollars = `${whole} ${currency} ${whole === "1" ? "dollar" : "dollars"}`;
  if (!cents) return dollars;
  const centWords = `${cents} ${cents === 1 ? "cent" : "cents"}`;
  if (Number(whole.replace(/,/g, "")) === 0) return `${cents} ${currency} ${cents === 1 ? "cent" : "cents"}`;
  return `${dollars} and ${centWords}`;
}

// Words that read badly when spoken by a phone voice.
export function spoken(text) {
  return String(text)
    .replace(/\bL\$:/g, "In Liberian dollars:")
    .replace(/\bUS\$:/g, "In US dollars:")
    .replace(/-(?=(?:L|US)\$)/g, "minus ")
    .replace(/\bL\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)/g, (_, value) => spokenMoney(value, "Liberian"))
    .replace(/\bUS\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)/g, (_, value) => spokenMoney(value, "US"))
    .replace(/\/(bag|bucket|kilo|kg|litre|gallon|stem|egg|bird|pack|bunch|bottle|tin|piece)\b/gi, " per $1")
    .replace(/(\d+)C\b/g, "$1 degrees")
    .replace(/\bTmrw\b/g, "Tomorrow")
    .replace(/\bmm\b/g, "millimetres")
    .replace(/Put your PIN:?/i, "Type your secret PIN on the phone keys, then press the hash key.")
    .replace(/^(\d)\. (.+)$/gm, (_, number, label) => `Press ${number} for ${label.toLowerCase()}.`)
    .replace(/:\s*$/gm, ".")
    .replace(/\.\.\.$/, ".")
    .replace(/;\s*/g, ". ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Each item: { key, text, language, audio, tts, missingTranslation }
//   audio: path of a recording (relative to the clips address), or null
//   tts: true when a computer voice must read `text` (always English)
//   missingTranslation: the caller chose a language this prompt has no
//     checked translation in, so English is used.
export function renderVoice(screen, language = "en") {
  const items = [];
  for (const part of screen.parts) {
    if (part.key) {
      const words = promptText(part.key, part.params, language);
      // A recording can only stand for a prompt with no names or numbers in it.
      const ownClip = !part.params ? findClip(part.key, words.language) : null;
      items.push({
        key: part.key,
        text: spoken(words.text),
        language: words.language,
        audio: ownClip ? `${words.language}/${ownClip}` : null,
        tts: !ownClip,
        missingTranslation: words.missing
      });
    } else if (part.list) {
      items.push({
        key: null,
        text: spoken(part.list.map((item, index) => `${index + 1}. ${item}`).join("\n")),
        language: "en",
        audio: null,
        tts: true,
        missingTranslation: language !== "en"
      });
    } else {
      items.push({ key: null, text: spoken(part.text), language: "en", audio: null, tts: true, missingTranslation: language !== "en" });
    }
  }
  // Typed numbers and PINs end with the hash key; say so once.
  const input = screen.end ? null : screen.input || { kind: "choice" };
  if (input && input.kind !== "choice" && !items.some((item) => /hash key/.test(item.text))) {
    const words = promptText("ivr.hash", {}, language);
    const clip = findClip("ivr.hash", words.language);
    items.push({
      key: "ivr.hash",
      text: words.text,
      language: words.language,
      audio: clip ? `${words.language}/${clip}` : null,
      tts: !clip,
      missingTranslation: words.missing
    });
  }
  return {
    items,
    input: input && {
      kind: input.kind,
      // A menu choice is one key; numbers and PINs end with #.
      numDigits: input.kind === "choice" ? 1 : null,
      finishOnKey: input.kind === "choice" ? null : "#",
      maxDigits: input.maxDigits || (input.kind === "pin" ? 6 : null)
    }
  };
}
