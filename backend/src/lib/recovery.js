import crypto from "node:crypto";
import { SECURITY_QUESTION_KEYS } from "./constants.js";

export function normalizeSecurityAnswer(value) {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized.length >= 2 ? normalized : null;
}

export function isSecurityQuestionKey(value) {
  return SECURITY_QUESTION_KEYS.includes(value);
}

export function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// OTPs are short-lived and attempt-limited, so a keyed digest is sufficient.
export function hashOtp(ownerId, code) {
  return crypto.createHash("sha256").update(`${ownerId}:${code}`).digest("hex");
}
