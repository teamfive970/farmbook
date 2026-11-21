import bcrypt from "bcryptjs";

const cost = () => Number(process.env.BCRYPT_COST || 10);

export function validatePinFormat(pin) {
  return typeof pin === "string" && /^\d{4,6}$/.test(pin);
}

export function hashPin(pin) {
  return bcrypt.hash(pin, cost());
}

export function verifyPin(pin, hash) {
  return bcrypt.compare(pin, hash);
}

// Security answers and other low-entropy secrets use the same slow hash as PINs.
export function hashSecret(secret) {
  return bcrypt.hash(secret, cost());
}

export function verifySecret(secret, hash) {
  return bcrypt.compare(secret, hash);
}
