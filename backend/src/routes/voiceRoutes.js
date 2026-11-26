import crypto from "node:crypto";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { clipFile } from "../lib/voiceClips.js";
import {
  endSimulatedCall,
  handleVoice,
  pressSimulatedKeys,
  simulatedCallTranscript,
  simulatorInfo,
  startSimulatedCall,
  voiceProvider
} from "../services/voiceService.js";

// Voice menu (IVR) addresses:
//   POST /api/voice?key=<VOICE_SECRET>      Africa's Talking call callbacks
//   GET  /api/voice/clips/<lang>/<file>     recorded prompts
//   GET  /api/voice/simulator               simulator settings, demo farmers
//   POST /api/voice/simulator/calls         start a simulated call
//   POST /api/voice/simulator/calls/:token/keys   press keys
//   POST /api/voice/simulator/calls/:token/end    hang up
//   GET  /api/voice/simulator/calls/:token  what was said and pressed
const router = Router();

const limited = (limit) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
  });

function secretMatches(given) {
  const secret = process.env.VOICE_SECRET || "";
  if (!secret || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicBase(req) {
  return (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}
const clipBase = (req) => `${publicBase(req)}/api/voice/clips`;

// Recorded prompts. Africa's Talking and the simulator page (another web
// address) fetch these, so they need no key and may be loaded cross-site.
// Only files found in the clips folder are served.
router.get("/clips/:language/:file", (req, res) => {
  const clip = clipFile(req.params.language, req.params.file);
  if (!clip) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
  res.set("Cache-Control", "public, max-age=86400");
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.type(clip.type);
  return res.sendFile(clip.path);
});

// --- Browser simulator -------------------------------------------------------

const json = express.json({ limit: "4kb" });
router.get("/simulator", limited(120), async (req, res, next) => {
  try {
    res.json(await simulatorInfo());
  } catch (error) {
    next(error);
  }
});
router.post("/simulator/calls", limited(30), json, async (req, res, next) => {
  try {
    res.status(201).json(await startSimulatedCall(req.body || {}, { clipBase: clipBase(req) }));
  } catch (error) {
    next(error);
  }
});
router.post("/simulator/calls/:token/keys", limited(240), json, async (req, res, next) => {
  try {
    res.json(await pressSimulatedKeys(req.params.token, req.body || {}, { clipBase: clipBase(req) }));
  } catch (error) {
    next(error);
  }
});
router.post("/simulator/calls/:token/end", limited(60), async (req, res, next) => {
  try {
    res.json(await endSimulatedCall(req.params.token));
  } catch (error) {
    next(error);
  }
});
router.get("/simulator/calls/:token", limited(120), async (req, res, next) => {
  try {
    res.json(await simulatedCallTranscript(req.params.token));
  } catch (error) {
    next(error);
  }
});

// --- Live calls (Africa's Talking) -------------------------------------------

router.post("/", limited(600), express.urlencoded({ extended: false, limit: "10kb" }), async (req, res) => {
  if (voiceProvider() !== "africastalking" || !secretMatches(req.query.key)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
  }
  const callbackUrl = `${publicBase(req)}/api/voice?key=${encodeURIComponent(req.query.key)}`;
  const body = await handleVoice(req.body || {}, { callbackUrl, clipBase: clipBase(req) });
  // Africa's Talking examples answer with text/plain carrying the XML.
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.send(body);
});

export default router;
