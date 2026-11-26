import crypto from "node:crypto";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleVoice } from "../services/voiceService.js";

// Africa's Talking Voice calls this address for each step of a call.
// Switched off until VOICE_SECRET is set. In Africa's Talking, set the voice
// number's callback URL to: https://<backend>/api/voice?key=<VOICE_SECRET>
const router = Router();

function secretMatches(given) {
  const secret = process.env.VOICE_SECRET || "";
  if (!secret || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true"
  })
);

router.post("/", express.urlencoded({ extended: false, limit: "10kb" }), async (req, res) => {
  if (!secretMatches(req.query.key)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
  }
  const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
  const callbackUrl = `${base.replace(/\/$/, "")}/api/voice?key=${encodeURIComponent(req.query.key)}`;
  let body;
  try {
    body = await handleVoice(req.body || {}, callbackUrl);
  } catch (error) {
    console.error("Voice failed:", error.message);
    body =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="woman">Sorry, something went wrong. Please call again later.</Say></Response>';
  }
  // Africa's Talking examples answer with text/plain carrying the XML.
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.send(body);
});

export default router;
