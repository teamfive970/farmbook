import { query } from "../config/database.js";
import { encryptionAvailable } from "../lib/crypto.js";
import { unauthenticated, inactive, forbidden } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";

async function loadFarmer(userId) {
  const { rows } = await query(
    `SELECT id, full_name, phone_number, county, district, community, status,
       security_question, created_at
     FROM farmers WHERE id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
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

async function loadAdmin(userId) {
  const { rows } = await query(
    `SELECT id, display_name, phone_number, status, security_question,
       access_code_ciphertext, created_at
     FROM admin_users WHERE id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
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

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) throw unauthenticated();

    const { rows } = await query(
      `SELECT id, role, farmer_id, admin_user_id, expires_at, revoked_at
       FROM sessions WHERE token_hash = $1`,
      [hashToken(token)]
    );
    const session = rows[0];
    if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
      throw unauthenticated("Your session has ended. Please sign in again.");
    }

    const user =
      session.role === "farmer"
        ? await loadFarmer(session.farmer_id)
        : await loadAdmin(session.admin_user_id);
    if (!user) throw unauthenticated();
    if (user.status !== "active") throw inactive();

    req.auth = { sessionId: session.id, role: session.role, userId: user.id, user };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) return next(unauthenticated());
    if (req.auth.role !== role) return next(forbidden());
    next();
  };
}
