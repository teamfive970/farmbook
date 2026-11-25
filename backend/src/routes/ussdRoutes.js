import crypto from "node:crypto";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleUssd } from "../services/ussdService.js";

// The USSD gateway (Africa's Talking) calls this address for every screen.
// It is switched off until USSD_SECRET is set. Give the gateway the callback
// URL with the secret in it: https://<backend>/api/ussd?key=<USSD_SECRET>
const router = Router();

function secretMatches(given) {
  const secret = process.env.USSD_SECRET || "";
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
  if (!secretMatches(req.query.key || req.get("x-ussd-key"))) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
  }
  const body = req.body || {};
  let reply;
  try {
    reply = await handleUssd({ sessionId: body.sessionId, phoneNumber: body.phoneNumber, text: body.text });
  } catch (error) {
    console.error("USSD failed:", error.message);
    reply = "END Sorry, something went wrong. Please try again later.";
  }
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.send(reply);
});

export default router;
