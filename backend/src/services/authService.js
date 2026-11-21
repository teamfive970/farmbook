import { query, withTransaction } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { encryptionAvailable } from "../lib/crypto.js";
import { badRequest, conflict, inactive, unauthorized } from "../lib/errors.js";
import { assertNotLocked, clearFailures, failAndThrow } from "../lib/lockout.js";
import { normalizePhone } from "../lib/phone.js";
import { hashPin, hashSecret, verifyPin, validatePinFormat } from "../lib/pin.js";
import { isSecurityQuestionKey, normalizeSecurityAnswer } from "../lib/recovery.js";
import { hashAccessCode, hashToken, newSessionToken, normalizeAccessCode } from "../lib/tokens.js";
import {
  requireEnum,
  requirePin,
  requireString
} from "../lib/validation.js";

const dummyHashPromise = hashPin("000000");

function serializeFarmer(row) {
  return {
    id: row.id,
    role: "farmer",
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    county: row.county,
    district: row.district,
    community: row.community,
    status: row.status,
    hasSecurityQuestion: Boolean(row.security_question),
    createdAt: row.created_at
  };
}

function serializeAdmin(row) {
  return {
    id: row.id,
    role: "admin",
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    status: row.status,
    hasSecurityQuestion: Boolean(row.security_question),
    canRevealAccessCode: Boolean(row.access_code_ciphertext) && encryptionAvailable(),
    createdAt: row.created_at
  };
}

// Farmers work offline for long stretches, so their sessions last much longer
// and renew whenever they are used (see middleware/auth.js). A farmer who opens
// the app at least once every FARMER_SESSION_DAYS never has to sign in again.
export function sessionDays(role) {
  const fallback = Number(process.env.SESSION_DAYS || 7);
  const days =
    role === "farmer" ? Number(process.env.FARMER_SESSION_DAYS || 180) : fallback;
  return Math.max(1, Number.isFinite(days) ? days : fallback);
}

export async function createSession(role, userId) {
  const token = newSessionToken();
  const days = sessionDays(role);
  const { rows } = await query(
    `INSERT INTO sessions (role, farmer_id, admin_user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
     RETURNING expires_at`,
    [role, role === "farmer" ? userId : null, role === "admin" ? userId : null, hashToken(token), days]
  );
  return { token, expiresAt: rows[0].expires_at };
}

export async function registerFarmer(body = {}) {
  const fullName = requireString(body.fullName, "fullName", { min: 2, max: 120, label: "Full name" });
  const phoneNumber = normalizePhone(body.phoneNumber);
  if (!phoneNumber) {
    throw badRequest("Enter a valid Liberian phone number, for example 077 000 0000.", {
      field: "phoneNumber"
    });
  }
  const county = requireEnum(body.county, COUNTIES, "county", "county");
  const district = requireString(body.district, "district", { max: 120, label: "District" });
  const community = requireString(body.community, "community", { max: 120, label: "Community" });
  const pin = requirePin(body.pin, "pin", "PIN");
  if (body.confirmPin !== undefined && body.confirmPin !== pin) {
    throw badRequest("The PIN and confirmation do not match.", { field: "confirmPin" });
  }

  let securityQuestion = null;
  let securityAnswerHash = null;
  if (body.securityQuestion !== undefined && body.securityQuestion !== "") {
    if (!isSecurityQuestionKey(body.securityQuestion)) {
      throw badRequest("Choose one of the recovery questions.", { field: "securityQuestion" });
    }
    const answer = normalizeSecurityAnswer(body.securityAnswer);
    if (!answer) {
      throw badRequest("Enter an answer for your recovery question.", { field: "securityAnswer" });
    }
    securityQuestion = body.securityQuestion;
    securityAnswerHash = await hashSecret(answer);
  }

  const pinHash = await hashPin(pin);

  let farmer;
  try {
    farmer = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO farmers
          (full_name, phone_number, county, district, community, pin_hash,
           security_question, security_answer_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, full_name, phone_number, county, district, community, status,
           security_question, created_at`,
        [
          fullName,
          phoneNumber,
          county,
          district,
          community,
          pinHash,
          securityQuestion,
          securityAnswerHash
        ]
      );
      return rows[0];
    });
  } catch (error) {
    if (error?.code === "23505") {
      throw conflict("An account with this phone number already exists. Try signing in.");
    }
    throw error;
  }

  const session = await createSession("farmer", farmer.id);
  return { ...session, user: serializeFarmer(farmer) };
}

const ADMIN_COLUMNS = `
  id, display_name, phone_number, pin_hash, status, security_question,
  security_answer_hash, access_code_ciphertext, created_at,
  failed_login_count, locked_until, recovery_failed_count, recovery_locked_until`;

const FARMER_COLUMNS = `
  id, full_name, phone_number, county, district, community, pin_hash, status,
  security_question, security_answer_hash, created_at,
  failed_login_count, locked_until, recovery_failed_count, recovery_locked_until`;

// Admins sign in with their access code only. A phone number is easy to learn,
// so phone + short PIN is not enough to reach the admin console. The phone may
// still identify an admin for SMS recovery, where the code proves possession.
async function findAdminByIdentifier(identifier, { allowPhone = true } = {}) {
  const code = normalizeAccessCode(identifier);
  if (code) {
    const { rows } = await query(
      `SELECT ${ADMIN_COLUMNS} FROM admin_users WHERE access_code_hash = $1`,
      [hashAccessCode(code)]
    );
    if (rows[0]) return rows[0];
  }
  const phone = allowPhone ? normalizePhone(identifier) : null;
  if (phone) {
    const { rows } = await query(
      `SELECT ${ADMIN_COLUMNS} FROM admin_users WHERE phone_number = $1`,
      [phone]
    );
    if (rows[0]) return rows[0];
  }
  return null;
}

async function findFarmerByPhone(identifier) {
  const phone = normalizePhone(identifier);
  if (!phone) return null;
  const { rows } = await query(`SELECT ${FARMER_COLUMNS} FROM farmers WHERE phone_number = $1`, [
    phone
  ]);
  return rows[0] || null;
}

// Shared by sign-in and PIN recovery. Administrators take precedence so a
// phone number can never silently address the wrong account type during SMS
// recovery. Sign-in passes allowAdminPhone: false (access code only for admins).
export async function findAccountByIdentifier(identifier, { allowAdminPhone = true } = {}) {
  const admin = await findAdminByIdentifier(identifier, { allowPhone: allowAdminPhone });
  if (admin) return { role: "admin", account: admin };
  const farmer = await findFarmerByPhone(identifier);
  if (farmer) return { role: "farmer", account: farmer };
  return null;
}

// Single sign-in entry point for farmers and admins. The account type is
// detected from the identifier: admin access code, admin phone, or farmer phone.
export async function login(body = {}) {
  const identifier = requireString(body.identifier, "identifier", {
    max: 80,
    label: "Phone number or access code"
  });
  if (typeof body.pin !== "string" || body.pin.length === 0) {
    throw badRequest("Enter your PIN.", { field: "pin" });
  }
  if (!validatePinFormat(body.pin)) throw unauthorized();

  const found = await findAccountByIdentifier(identifier, { allowAdminPhone: false });
  if (found) {
    assertNotLocked(found.account, "login");
    if (!(await verifyPin(body.pin, found.account.pin_hash))) {
      await failAndThrow(found.role, found.account.id, "login", unauthorized());
    }
    if (found.account.failed_login_count > 0 || found.account.locked_until) {
      await clearFailures(found.role, found.account.id, ["login"]);
    }
    if (found.account.status !== "active") throw inactive();
    const session = await createSession(found.role, found.account.id);
    return {
      ...session,
      user:
        found.role === "admin"
          ? serializeAdmin(found.account)
          : serializeFarmer(found.account)
    };
  }

  // Equalize response time so unknown accounts are not faster to detect.
  await verifyPin(body.pin, await dummyHashPromise);
  throw unauthorized();
}

// Confirms the signed-in user's PIN before a sensitive change. Wrong guesses
// count toward the same lock as sign-in, so a stolen session cannot be used to
// discover the PIN.
export async function verifyCurrentPin(role, userId, pin, client = null) {
  const table = role === "farmer" ? "farmers" : "admin_users";
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(
    `SELECT pin_hash, failed_login_count, locked_until FROM ${table} WHERE id = $1`,
    [userId]
  );
  const row = rows[0];
  const wrong = badRequest("Your current PIN is incorrect.", { field: "currentPin" });
  if (!row) throw wrong;
  assertNotLocked(row, "login");
  if (!(await verifyPin(pin, row.pin_hash))) await failAndThrow(role, userId, "login", wrong);
  if (row.failed_login_count > 0 || row.locked_until) {
    await clearFailures(role, userId, ["login"], client);
  }
}

export async function logout(sessionId) {
  await query(
    "UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
    [sessionId]
  );
}

export async function changePin(auth, body = {}) {
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");
  const newPin = requirePin(body.newPin, "newPin", "New PIN");
  if (auth.role === "admin") requireAdminPin(newPin);
  if (body.confirmPin !== undefined && body.confirmPin !== newPin) {
    throw badRequest("The new PIN and confirmation do not match.", { field: "confirmPin" });
  }
  if (newPin === currentPin) {
    throw badRequest("Choose a different PIN from your current one.", { field: "newPin" });
  }

  const table = auth.role === "farmer" ? "farmers" : "admin_users";
  const ownerColumn = auth.role === "farmer" ? "farmer_id" : "admin_user_id";

  await verifyCurrentPin(auth.role, auth.userId, currentPin);

  const pinHash = await hashPin(newPin);
  await withTransaction(async (client) => {
    await client.query(`UPDATE ${table} SET pin_hash = $1, updated_at = now() WHERE id = $2`, [
      pinHash,
      auth.userId
    ]);
    await client.query(
      `UPDATE sessions SET revoked_at = now()
       WHERE ${ownerColumn} = $1 AND id <> $2 AND revoked_at IS NULL`,
      [auth.userId, auth.sessionId]
    );
  });

  return { message: "Your PIN has been updated. Other devices have been signed out." };
}

export async function setupRecoveryQuestion(auth, body = {}) {
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");
  if (!isSecurityQuestionKey(body.securityQuestion)) {
    throw badRequest("Choose one of the recovery questions.", { field: "securityQuestion" });
  }
  const answer = normalizeSecurityAnswer(body.securityAnswer);
  if (!answer) {
    throw badRequest("Enter an answer for your recovery question.", { field: "securityAnswer" });
  }

  const table = auth.role === "farmer" ? "farmers" : "admin_users";
  await verifyCurrentPin(auth.role, auth.userId, currentPin);

  await query(
    `UPDATE ${table}
     SET security_question = $1, security_answer_hash = $2, updated_at = now()
     WHERE id = $3`,
    [body.securityQuestion, await hashSecret(answer), auth.userId]
  );
  return {
    message: "Your recovery question has been saved.",
    securityQuestion: body.securityQuestion
  };
}

// Admin PINs guard every farmer's records, so new ones must be 6 digits.
export function requireAdminPin(pin, field = "newPin") {
  if (!/^\d{6}$/.test(pin)) {
    throw badRequest("Admin PINs must be 6 digits.", { field });
  }
  return pin;
}

export { serializeFarmer, serializeAdmin };
