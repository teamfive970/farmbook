import { normalizeIdentifier } from "./offlineAuth.js";

// Accounts made with no network. The profile fields stay on the phone until the
// farmer sends the account with their PIN; the PIN itself and the recovery
// answer are never stored here.
const PENDING_KEY = "minders.pendingRegistrations";

export function isPendingUserId(id) {
  return typeof id === "string" && id.startsWith("local-acc-");
}

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(map));
}

export function readPendingRegistrations() {
  return Object.values(read()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function getPendingRegistration(id) {
  return read()[id] || null;
}

export function findPendingByPhone(phoneNumber) {
  const key = normalizeIdentifier(phoneNumber);
  if (!key) return null;
  return (
    Object.values(read()).find(
      (record) => normalizeIdentifier(record.phoneNumber) === key
    ) || null
  );
}

export function savePendingRegistration(record) {
  const map = read();
  map[record.id] = record;
  write(map);
  return record;
}

export function dropPendingRegistration(id) {
  const map = read();
  if (!(id in map)) return;
  delete map[id];
  try {
    write(map);
  } catch {
    // The records have already moved; a pending marker left behind is harmless.
  }
}

function newId() {
  if (globalThis.crypto?.randomUUID) return `local-acc-${crypto.randomUUID()}`;
  return `local-acc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Only the fields the server needs at registration. The recovery question is
// deliberately left out: it is added after the account reaches the server.
export function createPendingRegistration(fields) {
  return {
    id: newId(),
    fullName: fields.fullName,
    phoneNumber: fields.phoneNumber,
    county: fields.county,
    district: fields.district,
    community: fields.community,
    createdAt: Date.now()
  };
}

export function pendingUserFrom(record) {
  return {
    id: record.id,
    role: "farmer",
    fullName: record.fullName,
    phoneNumber: record.phoneNumber,
    county: record.county,
    district: record.district,
    community: record.community,
    status: "pending",
    hasSecurityQuestion: false,
    pendingRegistration: true
  };
}

export function registrationPayload(record, pin) {
  return {
    fullName: record.fullName,
    phoneNumber: record.phoneNumber,
    county: record.county,
    district: record.district,
    community: record.community,
    pin,
    confirmPin: pin
  };
}
