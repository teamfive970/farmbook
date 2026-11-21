import crypto from "node:crypto";

// AES-256-GCM at rest for the one secret an administrator must be able to
// read again: their access code. The hash stays the source of truth for login.
function encryptionKey() {
  const raw = process.env.CREDENTIAL_KEY;
  if (!raw) return null;
  let key;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  return key.length === 32 ? key : null;
}

export function encryptionAvailable() {
  return Boolean(encryptionKey());
}

export function encryptSecret(value) {
  const key = encryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(
    ":"
  );
}

export function decryptSecret(payload) {
  const key = encryptionKey();
  if (!key || typeof payload !== "string") return null;
  const [version, ivPart, tagPart, dataPart] = payload.split(":");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final()
    ]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
