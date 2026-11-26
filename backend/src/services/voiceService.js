import { ApiError } from "../lib/errors.js";
import { normalizePhone } from "../lib/phone.js";
import { farmerByPhone, handleCallStep } from "../channels/ivr.js";
import { readCallback, toXml, errorXml } from "../channels/providers/africastalking.js";
import { keyForToken, newCallToken, toJson } from "../channels/providers/simulator.js";
import { findSession } from "../channels/sessions.js";
import { demoPin, listDemoFarmers } from "./demoFarmerService.js";

export { spoken } from "../channels/render.js";

// The voice menu (IVR). The menu and the call sessions don't depend on any
// telephone company (channels/ivr.js). This file connects them to:
//   - Africa's Talking Voice, when VOICE_PROVIDER=africastalking (handleVoice)
//   - the browser IVR simulator (startSimulatedCall, pressSimulatedKeys, ...)

// Which telephone company carries real calls. Nothing by default; setting
// VOICE_SECRET alone (the earlier setup) still means Africa's Talking.
export function voiceProvider() {
  const named = String(process.env.VOICE_PROVIDER || "").trim().toLowerCase();
  if (named) return named;
  return process.env.VOICE_SECRET ? "africastalking" : "none";
}

// Africa's Talking calls this for each step of a call.
export async function handleVoice(body, { callbackUrl, clipBase }) {
  try {
    const callback = readCallback(body);
    if (!callback.sessionKey) return errorXml();
    const result = await handleCallStep({ provider: "africastalking", ...callback });
    return toXml(result, { callbackUrl, clipBase });
  } catch (error) {
    console.error("Voice failed:", error.message);
    return errorXml();
  }
}

// Kept for older tests: calls now live in the database, not in memory.
export function resetVoiceCalls() {}

// ---------------------------------------------------------------------------
// Browser simulator
// ---------------------------------------------------------------------------

// Demo mode (demo farmers only) is on unless IVR_SIMULATOR=off.
// Development mode (any farmer account, by phone number and PIN) is on when
// IVR_SIMULATOR_DEV=true, or outside production.
export function simulatorModes() {
  const on = String(process.env.IVR_SIMULATOR || "on").toLowerCase() !== "off";
  const dev =
    on &&
    (String(process.env.IVR_SIMULATOR_DEV || "").toLowerCase() === "true" ||
      (process.env.NODE_ENV !== "production" && String(process.env.IVR_SIMULATOR_DEV || "").toLowerCase() !== "false"));
  return { demo: on, development: dev };
}

export async function simulatorInfo() {
  const modes = simulatorModes();
  return {
    modes,
    liveProvider: voiceProvider() === "africastalking" ? "africastalking" : null,
    demoFarmers: modes.demo ? await listDemoFarmers() : [],
    demoPin: modes.demo ? demoPin() : null,
    languages: [
      { code: "en", name: "English", key: 1 },
      { code: "kpelle", name: "Kpelle", key: 2 },
      { code: "bassa", name: "Bassa", key: 3 }
    ]
  };
}

export async function startSimulatedCall({ mode, demoFarmerId, phone } = {}, { clipBase }) {
  const modes = simulatorModes();
  let caller;
  let isDemo = false;
  if (mode === "demo") {
    if (!modes.demo) throw new ApiError(403, "SIMULATOR_OFF", "The IVR simulator is switched off.");
    const demo = (await listDemoFarmers()).find((farmer) => farmer.id === demoFarmerId);
    if (!demo) throw new ApiError(400, "VALIDATION_ERROR", "Choose one of the demo farmers.", { field: "demoFarmerId" });
    caller = demo.phone;
    isDemo = true;
  } else if (mode === "development") {
    if (!modes.development) {
      throw new ApiError(403, "SIMULATOR_DEV_OFF", "Development mode is switched off on this server. Use demo mode.");
    }
    caller = normalizePhone(String(phone || ""));
    if (!caller) throw new ApiError(400, "VALIDATION_ERROR", "Enter a Liberian phone number.", { field: "phone" });
    const farmer = await farmerByPhone(caller);
    // Demo farmers are only for demo mode, and real accounts only for development mode.
    if (farmer?.is_demo) throw new ApiError(400, "VALIDATION_ERROR", "That is a demo farmer. Use demo mode.", { field: "phone" });
  } else {
    throw new ApiError(400, "VALIDATION_ERROR", "Choose demo or development mode.", { field: "mode" });
  }
  const token = newCallToken();
  const result = await handleCallStep({ provider: "simulator", sessionKey: keyForToken(token), phone: caller, isDemo });
  return toJson(result, { clipBase, token });
}

async function simulatorSession(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  return findSession("voice", "simulator", keyForToken(token));
}

export async function pressSimulatedKeys(token, { digits, step } = {}, { clipBase }) {
  const session = await simulatorSession(token);
  if (!session) throw new ApiError(404, "NOT_FOUND", "This call was not found. Start a new call.");
  if (typeof digits !== "string" || !/^[0-9*#]{0,12}$/.test(digits)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Keys must be 0-9, * or #.", { field: "digits" });
  }
  const result = await handleCallStep({
    provider: "simulator",
    sessionKey: session.sessionKey,
    phone: session.phone,
    digits,
    step: Number.isInteger(step) ? step : undefined,
    isDemo: session.isDemo
  });
  return toJson(result, { clipBase, token });
}

export async function endSimulatedCall(token) {
  const session = await simulatorSession(token);
  if (!session) throw new ApiError(404, "NOT_FOUND", "This call was not found.");
  await handleCallStep({ provider: "simulator", sessionKey: session.sessionKey, phone: session.phone, hangup: true });
  return { ended: true };
}

// What was said and pressed on a call (PINs shown as [pin]).
export async function simulatedCallTranscript(token) {
  const session = await simulatorSession(token);
  if (!session) throw new ApiError(404, "NOT_FOUND", "This call was not found.");
  return {
    status: session.endedAt ? "completed" : "active",
    endedReason: session.endedReason,
    demo: session.isDemo,
    language: session.language,
    startedAt: session.createdAt,
    endedAt: session.endedAt,
    transcript: session.state.transcript || [],
    saved: Object.keys(session.state.effects || {}).filter((key) => key.startsWith("save:")).length
  };
}
