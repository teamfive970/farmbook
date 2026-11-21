import crypto from "node:crypto";

export function newSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashToken(token) {
  return sha256(token);
}

export function normalizeAccessCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{5,39}$/.test(code) ? code : null;
}

export function hashAccessCode(code) {
  const normalized = normalizeAccessCode(code);
  return normalized ? sha256(normalized) : null;
}

export function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `MND-${suffix}`;
}
