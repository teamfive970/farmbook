import { promptText } from "../prompts.js";

// Africa's Talking Voice: their callback form fields in, their XML out.
// https://developers.africastalking.com/docs/voice/actions/overview
//
// Only used when VOICE_PROVIDER=africastalking and VOICE_SECRET are set, and
// a voice number exists. FarmBok's menu logic doesn't depend on any of this.

const xmlEscape = (text) =>
  String(text).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);

function say(text) {
  const voice = process.env.VOICE_SAY_VOICE || "woman";
  return `<Say voice="${xmlEscape(voice)}">${xmlEscape(text)}</Say>`;
}

// Recordings play; the rest is read by Africa's Talking's computer voice
// (next to each other, read as one).
function speech(items, clipBase) {
  const out = [];
  for (const item of items) {
    const last = out.at(-1);
    if (item.audio && clipBase) out.push({ play: `${clipBase}/${item.audio}` });
    else if (last && last.say !== undefined) last.say = `${last.say} ${item.text}`;
    else out.push({ say: item.text });
  }
  return out.map((part) => (part.play ? `<Play url="${xmlEscape(part.play)}"/>` : say(part.say)));
}

// What the callback sends, as FarmBok's call step.
export function readCallback(body = {}) {
  return {
    sessionKey: String(body.sessionId || "").slice(0, 120),
    phone: body.callerNumber,
    digits: body.dtmfDigits,
    hangup: String(body.isActive) === "0"
  };
}

export function toXml(result, { callbackUrl, clipBase }) {
  const open = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  if (!result) return "";
  const parts = speech(result.voice.items, clipBase);
  if (!result.voice.input) return `${open}${parts.join("")}</Response>`;
  // Their examples keep one prompt inside GetDigits; earlier parts play just
  // before it and the last one waits for the keys.
  const last = parts.pop() || say(".");
  const { numDigits, finishOnKey } = result.voice.input;
  const attributes =
    ` timeout="20"` +
    (finishOnKey ? ` finishOnKey="${finishOnKey}"` : ` numDigits="${numDigits || 1}"`) +
    ` callbackUrl="${xmlEscape(callbackUrl)}"`;
  return `${open}${parts.join("")}<GetDigits${attributes}>${last}</GetDigits>${say(promptText("ivr.noInput").text)}</Response>`;
}

export function errorXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say(promptText("common.error").text)}</Response>`;
}
