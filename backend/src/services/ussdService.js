import crypto from "node:crypto";
import { query } from "../config/database.js";
import { normalizePhone } from "../lib/phone.js";
import { Answers, P, runUssd } from "../channels/menu.js";
import { promptText } from "../channels/prompts.js";
import { renderUssd } from "../channels/render.js";
import { endSession, isOver, logStep, openSession, saveSession, withSessionLock } from "../channels/sessions.js";

export { WORK_LABELS } from "../channels/menu.js";

// USSD menu for farmers without a smartphone (dial a short code such as
// *384*123#), in the Africa's Talking format: every request carries the
// whole session so far in `text`, answers separated by "*". A reply starting
// "CON " waits for the next answer; "END " closes the menu.
//
// The menu itself (channels/menu.js) is shared with the voice menu. Here we
// keep the USSD session in Postgres: the PIN is checked once per session,
// saves happen once even if the gateway repeats a request, and a session that
// has ended or gone quiet for 5 minutes can't be continued.

const FARMER_COLUMNS = `id, full_name, county, status, pin_hash, failed_login_count, locked_until,
  preferred_language, is_demo`;

const end = (key) => `END ${promptText(key).text}`;

export async function handleUssd({ sessionId, phoneNumber, text } = {}) {
  const phone = normalizePhone(String(phoneNumber || ""));
  if (!phone) return end("auth.phoneOnly");
  const sessionKey = String(sessionId || "").slice(0, 80) || `${phone}-${Date.now()}`;

  return withSessionLock("ussd", "africastalking", sessionKey, async () => {
    let { session } = await openSession({ channel: "ussd", provider: "africastalking", sessionKey, phone });
    if (session.phone && session.phone !== phone) return end("common.error");
    // A gateway retry of the last request gets the same answer, even after
    // the session closed. Anything else on a closed session is refused.
    // The request text holds the PIN, so only a hash of it is kept.
    const textKey = crypto.createHash("sha256").update(`${session.id}:${String(text ?? "")}`).digest("hex");
    if (session.state?.last?.text === textKey) return session.state.last.reply;
    if (isOver(session)) return end("common.expired");

    const { rows } = await query(`SELECT ${FARMER_COLUMNS} FROM farmers WHERE phone_number = $1`, [phone]);
    const farmer = rows[0] || null;
    // Demo farmers belong to the simulator only.
    if (farmer?.is_demo) return end("common.error");

    const state = structuredClone(session.state || {});
    state.effects = state.effects || {};
    const ctx = {
      channel: "ussd",
      channelName: "USSD",
      phone,
      farmer,
      authenticated: session.authenticated && session.farmerId === farmer?.id,
      sessionKey: session.id,
      pinPositions: [],
      once: async (key, fn) => {
        if (Object.hasOwn(state.effects, key)) return state.effects[key];
        const value = await fn();
        const kept = value === undefined || value === null || (typeof value === "object" && !Array.isArray(value)) ? true : value;
        state.effects[key] = kept;
        // Saved at once, so a later failure in the same request can't lose it.
        await saveSession(session, { state });
        return kept;
      }
    };
    const answers = Answers.fromUssd(text);
    const screen = await runUssd(answers, ctx);
    const reply = renderUssd(screen);
    state.last = { text: textKey, reply };
    session = await saveSession(session, {
      state,
      steps: answers.items.length,
      farmerId: farmer?.id,
      authenticated: ctx.authenticated
    });
    const lastIndex = answers.items.length - 1;
    logStep(session, { input: answers.items.at(-1), screen, pinStep: ctx.pinPositions.includes(lastIndex) });
    if (reply.startsWith("END ")) await endSession(session, screen.invalid ? "invalid" : screen.id);
    return reply;
  });
}

// For tests and docs: the words of a USSD prompt.
export const ussdPrompt = (key, params) => promptText(key, params).text;
export { P };
