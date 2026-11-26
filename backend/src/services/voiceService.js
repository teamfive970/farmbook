import { handleUssd } from "./ussdService.js";

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

// Words that read badly when spoken by a phone voice.
export function spoken(screen) {
  return String(screen)
    .replace(/L\$\s?([\d,]+)/g, "$1 Liberian dollars")
    .replace(/US\$\s?([\d,]+)/g, "$1 US dollars")
    .replace(/\/(bag|bucket|kilo|kg|litre|gallon|stem|egg|bird|pack|bunch|bottle)\b/gi, " per $1")
    .replace(/(\d+)C\b/g, "$1 degrees")
    .replace(/\bTmrw\b/g, "Tomorrow")
    .replace(/\bmm\b/g, "millimetres")
    .replace(/Put your PIN:?/i, "Type your secret PIN on the phone keys, then press the hash key.")
    .replace(/^(\d)\. (.+)$/gm, (_, number, label) => `Press ${number} for ${label.toLowerCase()}.`)
    .replace(/\.\.\.$/, ".")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function say(text) {
  const voice = process.env.VOICE_SAY_VOICE || "woman";
  return `<Say voice="${xmlEscape(voice)}">${xmlEscape(text)}</Say>`;
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
      return response(say("We did not hear any keys. Please call again. Goodbye."));
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
    screen = "END To make your FarmBok account, dial the FarmBok USSD code on your phone, or ask your extension officer. Then call again.";
  }

  if (screen.startsWith("CON ")) {
    const prompt = spoken(screen.slice(4));
    const finish = /PIN/i.test(screen) ? ' finishOnKey="#"' : ' numDigits="1"';
    return response(
      `<GetDigits timeout="20"${finish} callbackUrl="${xmlEscape(callbackUrl)}">${say(prompt)}</GetDigits>` +
        say("We did not hear any keys. Please call again. Goodbye.")
    );
  }
  calls.delete(id);
  return response(say(`${spoken(screen.replace(/^END /, ""))} Thank you for calling FarmBok. Goodbye.`));
}

export function resetVoiceCalls() {
  calls.clear();
}
