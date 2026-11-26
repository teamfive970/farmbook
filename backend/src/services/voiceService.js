import { clipKey, clipLanguage, findClip, sentences } from "../lib/voiceClips.js";
import { COUNTIES } from "../lib/constants.js";
import { handleUssd, WORK_LABELS } from "./ussdService.js";

// Voice menu (IVR): farmers call a FarmBok phone number and hear the menu,
// then press keys on any phone, even one without a screen or for someone who
// cannot read. It works with the Africa's Talking Voice API: for each step we
// answer with XML that says the words (<Say>) and waits for keys (<GetDigits>).
//
// The menu is the same as the USSD menu (ussdService.js), so both stay in
// step: each USSD screen is turned into spoken words, "1. Weather" becomes
// "Press 1 for weather". The keys pressed so far are kept on the server for
// the call (never put in a URL), keyed by the call's session id.

const CALL_TTL_MS = 30 * 60 * 1000;
const calls = new Map();

function cleanup() {
  const now = Date.now();
  for (const [id, call] of calls) if (now - call.at > CALL_TTL_MS) calls.delete(id);
}

const xmlEscape = (text) =>
  String(text).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);

// "3,523" -> "3,523 Liberian dollars"; "0.13" -> "13 US cents";
// "2.5" -> "2 Liberian dollars and 50 cents".
function spokenMoney(amount, currency) {
  const [whole, fraction = ""] = String(amount).split(".");
  const cents = fraction ? Number(`${fraction}0`.slice(0, 2)) : 0;
  const dollars = `${whole} ${currency} ${whole === "1" ? "dollar" : "dollars"}`;
  const centWords = `${cents} ${cents === 1 ? "cent" : "cents"}`;
  if (!cents) return dollars;
  if (Number(whole.replace(/,/g, "")) === 0) return `${cents} ${currency} ${cents === 1 ? "cent" : "cents"}`;
  return `${dollars} and ${centWords}`;
}

// Words that read badly when spoken by a phone voice.
export function spoken(screen) {
  return String(screen)
    .replace(/\bL\$:/g, "In Liberian dollars:")
    .replace(/\bUS\$:/g, "In US dollars:")
    .replace(/-(?=(?:L|US)\$)/g, "minus ")
    .replace(/\bL\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)/g, (_, amount) => spokenMoney(amount, "Liberian"))
    .replace(/\bUS\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)/g, (_, amount) => spokenMoney(amount, "US"))
    .replace(/\/(bag|bucket|kilo|kg|litre|gallon|stem|egg|bird|pack|bunch|bottle)\b/gi, " per $1")
    .replace(/(\d+)C\b/g, "$1 degrees")
    .replace(/\bTmrw\b/g, "Tomorrow")
    .replace(/\bmm\b/g, "millimetres")
    .replace(/Put your PIN:?/i, "Type your secret PIN on the phone keys, then press the hash key.")
    .replace(/^(\d)\. (.+)$/gm, (_, number, label) => `Press ${number} for ${label.toLowerCase()}.`)
    .replace(/\.\.\.$/, ".")
    .replace(/;\s*/g, ". ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const NO_KEYS = "We did not hear any keys. Please call again. Goodbye.";
const GOODBYE = "Thank you for calling FarmBok. Goodbye.";
const HOW_TO_JOIN =
  "To make your FarmBok account, dial the FarmBok USSD code on your phone, or ask your extension officer. Then call again.";

function say(text) {
  const voice = process.env.VOICE_SAY_VOICE || "woman";
  return `<Say voice="${xmlEscape(voice)}">${xmlEscape(text)}</Say>`;
}

// Turns spoken text into <Play> for sentences that have a recording and
// <Say> for the rest (next to each other, <Say> parts are joined so the
// computer voice reads them as one). Returns the parts in order.
function speechParts(text, clipBase) {
  const language = clipLanguage();
  const parts = [];
  for (const sentence of sentences(text)) {
    const file = clipBase ? findClip(sentence, language) : null;
    const last = parts.at(-1);
    if (file) parts.push({ play: `${clipBase}/${language}/${file}` });
    else if (last && last.say !== undefined) last.say = `${last.say} ${sentence}`;
    else parts.push({ say: sentence });
  }
  return parts.map((part) => (part.play ? `<Play url="${xmlEscape(part.play)}"/>` : say(part.say)));
}

// Africa's Talking's examples keep one prompt inside <GetDigits>, so
// earlier parts play just before it and the last part waits for the keys.
function askDigits(text, attributes, clipBase) {
  const parts = speechParts(text, clipBase);
  const last = parts.pop() || say(text);
  return `${parts.join("")}<GetDigits${attributes}>${last}</GetDigits>`;
}

function clipBaseFrom(callbackUrl) {
  try {
    return `${new URL(callbackUrl).origin}/api/voice/clips`;
  } catch {
    return null;
  }
}

// Every fixed sentence the voice menu can say, for the people recording
// clips: [{ key, text }]. Sentences with names, prices or dates in them are
// left to the computer voice.
export function phraseCatalog() {
  const list = (items) => items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const screens = [
    "Welcome to FarmBok. Keep your farm records.\n1. How to make an account\n2. Weather\n3. Market prices",
    "FarmBok.\nPut your PIN:",
    "1. Record farm work\n2. Weather\n3. Market prices\n4. My messages\n5. My money\n6. Weekly price SMS",
    "Which farm?",
    `What work?\n${list(WORK_LABELS)}`,
    "When?\n1. Today\n2. Yesterday",
    `Weather for which county?\n${list(COUNTIES.slice(0, 8))}\n9. More`,
    list(COUNTIES.slice(8)),
    "Get market prices by SMS every week?\n1. Yes, turn it on\n2. No",
    "Weekly price SMS is ON.\n1. Turn it off\n2. Keep it on",
    "Weekly price SMS is now OFF.",
    "Weekly price SMS is now ON. Your first prices will come soon.",
    "OK. You will still get prices every week.",
    "OK. No price SMS.",
    "Wrong choice. Please dial again.",
    "Wrong PIN. Please dial again.",
    "Too many wrong tries. Wait some minutes and dial again.",
    "This account is not active. Please contact your extension officer.",
    "You have no farm yet. Add your farm in the FarmBok app first.",
    "No new messages.",
    "No money records yet.",
    "Your money (all time).",
    "No market prices yet. More farmers need to record sales.",
    "Weather is not available right now. Try again later.",
    "FarmBok works with Liberian phone numbers only.",
    "Thank you.",
    HOW_TO_JOIN,
    NO_KEYS,
    GOODBYE,
    "Sorry, something went wrong. Please call again later."
  ];
  const seen = new Map();
  for (const screen of screens) {
    for (const text of sentences(spoken(screen))) {
      const key = clipKey(text);
      if (!seen.has(key)) seen.set(key, { key, text });
    }
  }
  return [...seen.values()];
}

function response(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

// What the voice gateway gets back for one step of the call.
export async function handleVoice({ sessionId, callerNumber, dtmfDigits, isActive }, callbackUrl) {
  cleanup();
  if (String(isActive) === "0") {
    calls.delete(sessionId);
    return "";
  }
  const id = String(sessionId || "");
  const call = calls.get(id) || { answers: [], at: Date.now() };
  const digits = String(dtmfDigits || "").replace(/[^0-9]/g, "");
  if (dtmfDigits !== undefined && dtmfDigits !== null && calls.has(id)) {
    if (!digits) {
      calls.delete(id);
      return response(speechParts(NO_KEYS, clipBaseFrom(callbackUrl)).join(""));
    }
    call.answers.push(digits);
  }
  call.at = Date.now();
  calls.set(id, call);

  // New callers cannot type a name with phone keys, so making an account
  // goes through USSD or the app.
  const text = call.answers.join("*");
  let screen = await handleUssd({ sessionId: `voice-${id}`, phoneNumber: callerNumber, text });
  if (/^CON Welcome to FarmBok/.test(screen) && call.answers.length === 0) {
    screen = screen.replace("1. Make my account", "1. How to make an account");
  }
  if (call.answers[0] === "1" && /^CON Your full name/.test(screen)) {
    screen = `END ${HOW_TO_JOIN}`;
  }

  const clipBase = clipBaseFrom(callbackUrl);
  if (screen.startsWith("CON ")) {
    const prompt = spoken(screen.slice(4));
    const finish = /PIN/i.test(screen) ? ' finishOnKey="#"' : ' numDigits="1"';
    return response(
      askDigits(prompt, ` timeout="20"${finish} callbackUrl="${xmlEscape(callbackUrl)}"`, clipBase) +
        speechParts(NO_KEYS, clipBase).join("")
    );
  }
  calls.delete(id);
  return response(speechParts(`${spoken(screen.replace(/^END /, ""))} ${GOODBYE}`, clipBase).join(""));
}

export function resetVoiceCalls() {
  calls.clear();
}
