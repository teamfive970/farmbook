import { query, withTransaction } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { encryptionAvailable } from "../lib/crypto.js";
import { badRequest, conflict, inactive, unauthorized } from "../lib/errors.js";
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

export async function createSession(role, userId) {
  const token = newSessionToken();
  const days = Math.max(1, Number(process.env.SESSION_DAYS || 7));
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
  security_answer_hash, access_code_ciphertext, created_at`;

const FARMER_COLUMNS = `
  id, full_name, phone_number, county, district, community, pin_hash, status,
  security_question, security_answer_hash, created_at`;

async function findAdminByIdentifier(identifier) {
  const code = normalizeAccessCode(identifier);
  if (code) {
    const { rows } = await query(
      `SELECT ${ADMIN_COLUMNS} FROM admin_users WHERE access_code_hash = $1`,
      [hashAccessCode(code)]
    );
    if (rows[0]) return rows[0];
  }
  const phone = normalizePhone(identifier);
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
// phone number can never silently address the wrong account type.
export async function findAccountByIdentifier(identifier) {
  const admin = await findAdminByIdentifier(identifier);
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

  const found = await findAccountByIdentifier(identifier);
  if (found) {
    if (!(await verifyPin(body.pin, found.account.pin_hash))) throw unauthorized();
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

export async function logout(sessionId) {
  await query(
    "UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
    [sessionId]
  );
}

export async function changePin(auth, body = {}) {
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");
  const newPin = requirePin(body.newPin, "newPin", "New PIN");
  if (body.confirmPin !== undefined && body.confirmPin !== newPin) {
    throw badRequest("The new PIN and confirmation do not match.", { field: "confirmPin" });
  }
  if (newPin === currentPin) {
    throw badRequest("Choose a different PIN from your current one.", { field: "newPin" });
  }

  const table = auth.role === "farmer" ? "farmers" : "admin_users";
  const ownerColumn = auth.role === "farmer" ? "farmer_id" : "admin_user_id";

  const { rows } = await query(`SELECT pin_hash FROM ${table} WHERE id = $1`, [auth.userId]);
  if (!rows[0] || !(await verifyPin(currentPin, rows[0].pin_hash))) {
    throw badRequest("Your current PIN is incorrect.", { field: "currentPin" });
  }

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
  const { rows } = await query(`SELECT pin_hash FROM ${table} WHERE id = $1`, [auth.userId]);
  if (!rows[0] || !(await verifyPin(currentPin, rows[0].pin_hash))) {
    throw badRequest("Your current PIN is incorrect.", { field: "currentPin" });
  }

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

export { serializeFarmer, serializeAdmin };
