import { query, withTransaction } from "../config/database.js";
import { SECURITY_QUESTIONS } from "../lib/constants.js";
import { ApiError, badRequest, inactive, unauthorized } from "../lib/errors.js";
import { hashPin, hashSecret, verifySecret } from "../lib/pin.js";
import {
  generateOtp,
  hashOtp,
  isSecurityQuestionKey,
  normalizeSecurityAnswer
} from "../lib/recovery.js";
import { assertNotLocked, failAndThrow } from "../lib/lockout.js";
import { sendPasswordResetOtp, smsAvailable } from "../lib/sms.js";
import { requirePin, requireString } from "../lib/validation.js";
import {
  createSession,
  findAccountByIdentifier,
  serializeAdmin,
  serializeFarmer
} from "./authService.js";

const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

const dummyAnswerHashPromise = hashSecret("minders-dummy-answer");

const GENERIC_QUESTION_ERROR = "Those recovery details do not match our records.";
const GENERIC_CODE_ERROR = "That code is incorrect or has expired.";
const GENERIC_SMS_SENT =
  "If SMS recovery is available for this account, a code has been sent to its phone number.";

function ownerColumn(role) {
  return role === "farmer" ? "farmer_id" : "admin_user_id";
}

function serializeAccount(role, account) {
  return role === "admin" ? serializeAdmin(account) : serializeFarmer(account);
}

async function resetPinAndSignIn(role, account, newPin, confirmPin) {
  const pin = requirePin(newPin, "newPin", "New PIN");
  if (confirmPin !== undefined && confirmPin !== pin) {
    throw badRequest("The new PIN and confirmation do not match.", { field: "confirmPin" });
  }

  if (role === "admin" && !/^\d{6}$/.test(pin)) {
    throw badRequest("Admin PINs must be 6 digits.", { field: "newPin" });
  }

  const pinHash = await hashPin(pin);
  const column = ownerColumn(role);
  const table = role === "farmer" ? "farmers" : "admin_users";

  // A successful recovery also lifts any sign-in or recovery lock.
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE ${table}
       SET pin_hash = $1, updated_at = now(),
           failed_login_count = 0, locked_until = NULL,
           recovery_failed_count = 0, recovery_locked_until = NULL
       WHERE id = $2`,
      [pinHash, account.id]
    );
    await client.query(
      `UPDATE sessions SET revoked_at = now()
       WHERE ${column} = $1 AND revoked_at IS NULL`,
      [account.id]
    );
    await client.query(
      `UPDATE recovery_otps SET used_at = now()
       WHERE ${column} = $1 AND used_at IS NULL`,
      [account.id]
    );
  });

  const session = await createSession(role, account.id);
  return { ...session, user: serializeAccount(role, account) };
}

export function recoveryOptions() {
  return {
    smsAvailable: smsAvailable(),
    questions: SECURITY_QUESTIONS
  };
}

export async function recoverWithSecurityQuestion(body = {}) {
  const identifier = requireString(body.identifier, "identifier", {
    max: 80,
    label: "Phone number or access code"
  });
  const question = body.securityQuestion;
  const answer = normalizeSecurityAnswer(body.securityAnswer);
  const newPin = requirePin(body.newPin, "newPin", "New PIN");
  if (body.confirmPin !== undefined && body.confirmPin !== newPin) {
    throw badRequest("The new PIN and confirmation do not match.", { field: "confirmPin" });
  }

  // Security questions are easy to research, so they never unlock an admin
  // account; admins recover by SMS or through another administrator.
  const found = await findAccountByIdentifier(identifier);
  if (found) assertNotLocked(found.account, "recovery");
  if (
    !found ||
    found.role === "admin" ||
    !found.account.security_answer_hash ||
    !isSecurityQuestionKey(question) ||
    found.account.security_question !== question ||
    !answer
  ) {
    await verifySecret("wrong-answer", await dummyAnswerHashPromise);
    // A wrong question choice for a real farmer counts as a wrong answer, so
    // all five questions cannot be tried for free.
    if (found && found.role === "farmer" && found.account.security_answer_hash) {
      await failAndThrow(found.role, found.account.id, "recovery", unauthorized(GENERIC_QUESTION_ERROR));
    }
    throw unauthorized(GENERIC_QUESTION_ERROR);
  }

  const matches = await verifySecret(answer, found.account.security_answer_hash);
  if (!matches) {
    await failAndThrow(found.role, found.account.id, "recovery", unauthorized(GENERIC_QUESTION_ERROR));
  }
  if (found.account.status !== "active") throw inactive();

  return resetPinAndSignIn(found.role, found.account, newPin, body.confirmPin);
}

export async function requestSmsRecovery(body = {}) {
  if (!smsAvailable()) {
    throw new ApiError(
      503,
      "SMS_UNAVAILABLE",
      "SMS recovery is not available right now. Use your security question instead."
    );
  }
  const identifier = requireString(body.identifier, "identifier", {
    max: 80,
    label: "Phone number or access code"
  });

  const found = await findAccountByIdentifier(identifier);
  if (!found || found.account.status !== "active" || !found.account.phone_number) {
    return { message: GENERIC_SMS_SENT };
  }

  const { role, account } = found;
  const column = ownerColumn(role);

  const recent = await query(
    `SELECT created_at FROM recovery_otps
     WHERE ${column} = $1 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [account.id]
  );
  if (
    recent.rows[0] &&
    Date.now() - new Date(recent.rows[0].created_at).getTime() < OTP_RESEND_SECONDS * 1000
  ) {
    return { message: GENERIC_SMS_SENT };
  }

  const code = generateOtp();
  const codeHash = hashOtp(account.id, code);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE recovery_otps SET used_at = now()
       WHERE ${column} = $1 AND used_at IS NULL`,
      [account.id]
    );
    await client.query(
      `INSERT INTO recovery_otps
        (role, farmer_id, admin_user_id, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
      [
        role,
        role === "farmer" ? account.id : null,
        role === "admin" ? account.id : null,
        codeHash,
        OTP_MINUTES
      ]
    );
    await client.query("DELETE FROM recovery_otps WHERE created_at < now() - interval '1 day'");
  });

  try {
    await sendPasswordResetOtp(account.phone_number, code);
  } catch (error) {
    console.error("SMS recovery delivery failed:", error.message);
    await query("UPDATE recovery_otps SET used_at = now() WHERE code_hash = $1", [codeHash]);
    throw new ApiError(
      502,
      "SMS_DELIVERY_FAILED",
      "We could not send the SMS. Please try again or use your security question."
    );
  }

  return { message: GENERIC_SMS_SENT };
}

export async function recoverWithSms(body = {}) {
  const identifier = requireString(body.identifier, "identifier", {
    max: 80,
    label: "Phone number or access code"
  });
  const code = requireString(body.code, "code", { min: 6, max: 6, label: "Code" });
  if (!/^\d{6}$/.test(code)) throw badRequest("Enter the 6 digit code.", { field: "code" });
  const newPin = requirePin(body.newPin, "newPin", "New PIN");
  if (body.confirmPin !== undefined && body.confirmPin !== newPin) {
    throw badRequest("The new PIN and confirmation do not match.", { field: "confirmPin" });
  }

  const found = await findAccountByIdentifier(identifier);
  if (!found) {
    await verifySecret("wrong-answer", await dummyAnswerHashPromise);
    throw unauthorized(GENERIC_CODE_ERROR);
  }

  const { role, account } = found;
  const column = ownerColumn(role);
  const { rows } = await query(
    `SELECT id, code_hash, expires_at, attempts FROM recovery_otps
     WHERE ${column} = $1 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [account.id]
  );
  const otp = rows[0];
  if (!otp) throw unauthorized(GENERIC_CODE_ERROR);
  if (new Date(otp.expires_at) <= new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) {
    await query("UPDATE recovery_otps SET used_at = now() WHERE id = $1", [otp.id]);
    throw unauthorized(GENERIC_CODE_ERROR);
  }

  // Count the attempt and check the limit in one statement, so parallel
  // requests cannot get more than OTP_MAX_ATTEMPTS guesses.
  const counted = await query(
    `UPDATE recovery_otps SET attempts = attempts + 1
     WHERE id = $1 AND used_at IS NULL AND expires_at > now() AND attempts < $2
     RETURNING code_hash`,
    [otp.id, OTP_MAX_ATTEMPTS]
  );
  if (!counted.rows[0] || hashOtp(account.id, code) !== counted.rows[0].code_hash) {
    throw unauthorized(GENERIC_CODE_ERROR);
  }
  if (account.status !== "active") throw inactive();

  // Mark used atomically too: only the first matching request may reset the PIN.
  const consumed = await query(
    "UPDATE recovery_otps SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id",
    [otp.id]
  );
  if (!consumed.rows[0]) throw unauthorized(GENERIC_CODE_ERROR);
  return resetPinAndSignIn(role, account, newPin, body.confirmPin);
}
