import { query } from "../config/database.js";
import { normalizePhone } from "../lib/phone.js";
import { Answers, P, runVoice } from "./menu.js";
import { renderVoice } from "./render.js";
import { endSession, isOver, logStep, openSession, saveSession, withSessionLock } from "./sessions.js";

// The voice menu (IVR), whatever carries the call: Africa's Talking today,
// the browser simulator, or another provider later. A provider adapter turns
// its callback into handleCallStep(...) and the result into its own format
// (see providers/).
//
// Each call is a row in channel_sessions: the keys pressed so far (PINs kept
// only as "*"), what has been saved, and a short transcript.

const FARMER_COLUMNS = `id, full_name, county, status, pin_hash, failed_login_count, locked_until,
  preferred_language, is_demo`;

export async function farmerByPhone(phone) {
  const { rows } = await query(`SELECT ${FARMER_COLUMNS} FROM farmers WHERE phone_number = $1`, [phone]);
  return rows[0] || null;
}

async function farmerById(id) {
  const { rows } = await query(`SELECT ${FARMER_COLUMNS} FROM farmers WHERE id = $1`, [id]);
  return rows[0] || null;
}

function onceFor(state) {
  state.effects = state.effects || {};
  return async (key, fn) => {
    if (Object.hasOwn(state.effects, key)) return state.effects[key];
    const value = await fn();
    // Keep small answers (a list of titles, yes/no); a saved record is just "done".
    const kept =
      value === undefined || value === null || typeof value === "object" && !Array.isArray(value) ? true : value;
    state.effects[key] = kept;
    return kept;
  };
}

async function runScreen(session, farmer, state) {
  const ctx = {
    channel: "voice",
    channelName: session.provider === "simulator" ? "IVR simulator" : "phone call",
    phone: session.phone,
    farmer,
    authenticated: session.authenticated && session.farmerId === farmer?.id,
    sessionKey: session.id,
    once: onceFor(state),
    pinPositions: [],
    language: session.language || "en"
  };
  const screen = await runVoice(new Answers([...(state.answers || [])]), ctx);
  return { screen, ctx };
}

const ended = (reason, parts) => ({ id: reason, end: true, final: true, parts });

// One step of a call.
//   provider: "africastalking" | "simulator"
//   sessionKey: the provider's call id
//   phone: the caller's number (as the provider gives it)
//   digits: keys pressed for the last question (undefined on the first step)
//   step: for the simulator, how many answers it has sent so far (a repeat
//     of the same step is answered with the same screen, not counted twice)
//   hangup: the provider says the call is over
// Returns { session, screen, voice } or null after a hang-up.
export async function handleCallStep({ provider, sessionKey, phone, digits, step, hangup = false, isDemo = false }) {
  return withSessionLock("voice", provider, sessionKey, async () => {
    const normalized = normalizePhone(String(phone || "")) || String(phone || "");
    let { session } = await openSession({ channel: "voice", provider, sessionKey, phone: normalized, isDemo });
    if (hangup) {
      await endSession(session, "hangup");
      return null;
    }
    if (isOver(session)) {
      const screen = ended("expired", [P("common.expired")]);
      return { session, screen, voice: renderVoice(screen, session.language || "en") };
    }

    const state = structuredClone(session.state || {});
    state.answers = state.answers || [];
    const farmer = session.farmerId ? await farmerById(session.farmerId) : await farmerByPhone(normalized);

    let notice = null;
    const repeat = step !== undefined && step !== null && Number(step) !== state.answers.length;
    if (digits !== undefined && digits !== null && !repeat && state.started) {
      const pressed = String(digits).replace(/[^0-9*#]/g, "").replace(/#$/, "");
      if (!pressed) {
        const screen = ended("noinput", [P("ivr.noInput")]);
        await saveSession(session, { state, farmerId: farmer?.id });
        await endSession(session, "no-input");
        return { session, screen, voice: renderVoice(screen, session.language || "en") };
      }
      state.answers.push(pressed);
    }
    state.started = true;

    let { screen, ctx } = await runScreen(session, farmer, state);
    const inputIndex = state.answers.length - 1;
    if (screen.invalid) {
      // A key that is not on the menu: say so and ask the same question again.
      state.answers.pop();
      ({ screen, ctx } = await runScreen(session, farmer, state));
      notice = P("ivr.invalid");
    }
    // PINs never stay in the session: once checked they are kept as "*".
    for (const position of ctx.pinPositions) if (position < state.answers.length) state.answers[position] = "*";

    const shown = notice ? { ...screen, parts: [notice, ...screen.parts] } : screen;
    state.transcript = [
      ...(state.transcript || []),
      { at: new Date().toISOString(), input: digits === undefined || repeat ? null : ctx.pinPositions.includes(inputIndex) ? "[pin]" : state.answers.at(-1) ?? null, screen: shown.id }
    ].slice(-60);

    session = await saveSession(session, {
      state,
      steps: state.answers.length,
      farmerId: farmer?.id,
      language: ctx.language,
      authenticated: ctx.authenticated
    });
    logStep(session, { input: digits, screen: shown, pinStep: ctx.pinPositions.includes(inputIndex) });
    if (shown.end) session = await endSession(session, shown.id);
    return { session, screen: shown, voice: renderVoice(shown, ctx.language) };
  });
}
