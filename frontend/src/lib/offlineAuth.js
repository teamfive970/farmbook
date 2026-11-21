import { openDB } from "idb";
import { ApiError } from "./api.js";

// Offline sign-in needs a way to check the PIN without the server. We keep a
// salted PBKDF2 verifier on the device after a successful online sign-in; the
// PIN itself is never stored, and five wrong tries lock the device until the
// farmer signs in online again.
const DB_NAME = "minders-auth";
const STORE = "accounts";
const ITERATIONS = 210000;
const MAX_ATTEMPTS = 5;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

let dbPromise = null;

function authDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "identifier" });
      }
    });
  }
  return dbPromise;
}

function toBase64(bytes) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// Same rule as the backend: 0770000000, 770000000, +231770000000 all match.
export function normalizeIdentifier(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("231")) return `231${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("0")) return `231${digits.slice(1)}`;
  if (digits.length === 9) return `231${digits}`;
  return raw.toUpperCase();
}

async function derive(pin, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

function sameBytes(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

function cryptoAvailable() {
  return Boolean(globalThis.crypto && globalThis.crypto.subtle);
}

// Called after every successful online sign-in or PIN change so this phone can
// sign the farmer in again without a connection.
export async function rememberOfflineLogin(identifier, pin, user) {
  if (!user || user.role !== "farmer" || !user.phoneNumber) return;
  if (!cryptoAvailable()) return;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, ITERATIONS);
  const db = await authDb();
  await db.put(STORE, {
    identifier: normalizeIdentifier(user.phoneNumber || identifier),
    userId: user.id,
    profile: user,
    salt: toBase64(salt),
    hash: toBase64(hash),
    iterations: ITERATIONS,
    failedAttempts: 0,
    locked: false,
    updatedAt: Date.now()
  });
}

export async function signInOffline(identifier, pin) {
  if (!cryptoAvailable()) {
    throw new ApiError(
      0,
      "OFFLINE_SIGN_IN_UNAVAILABLE",
      "Offline sign-in is not available on this device. Connect to the internet to sign in."
    );
  }

  let account = null;
  try {
    account = await (await authDb()).get(STORE, normalizeIdentifier(identifier));
  } catch {
    throw new ApiError(
      0,
      "OFFLINE_SIGN_IN_UNAVAILABLE",
      "Offline sign-in is not available on this device. Connect to the internet to sign in."
    );
  }

  if (!account) {
    throw new ApiError(
      0,
      "OFFLINE_SIGN_IN_UNAVAILABLE",
      "This phone has not signed in to Minders before. Connect to the internet to sign in the first time."
    );
  }

  if (account.locked) {
    throw new ApiError(
      0,
      "OFFLINE_SIGN_IN_LOCKED",
      "Too many wrong PINs. Connect to the internet and sign in to unlock this phone."
    );
  }

  const candidate = await derive(pin, fromBase64(account.salt), account.iterations || ITERATIONS);
  if (!sameBytes(candidate, fromBase64(account.hash))) {
    const failedAttempts = (account.failedAttempts || 0) + 1;
    const locked = failedAttempts >= MAX_ATTEMPTS;
    await (await authDb()).put(STORE, { ...account, failedAttempts, locked, updatedAt: Date.now() });
    if (locked) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "That PIN is not correct. Connect to the internet to unlock this phone."
      );
    }
    const left = MAX_ATTEMPTS - failedAttempts;
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      `That PIN is not correct. ${left} ${left === 1 ? "try" : "tries"} left before you must sign in online.`
    );
  }

  if (account.failedAttempts > 0 || account.locked) {
    await (await authDb()).put(STORE, { ...account, failedAttempts: 0, locked: false, updatedAt: Date.now() });
  }
  return account.profile;
}
