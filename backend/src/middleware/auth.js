import { query } from "../config/database.js";
import { encryptionAvailable } from "../lib/crypto.js";
import { unauthenticated, inactive, forbidden } from "../lib/errors.js";
import { hashToken } from "../lib/tokens.js";
import { sessionDays } from "../services/authService.js";

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
      `SELECT id, role, farmer_id, admin_user_id, expires_at, revoked_at, last_used_at
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

    if (session.role === "admin") {
      // Admin consoles close themselves after a short idle period. The session
      // is revoked rather than silently extended, so a shared laptop cannot be
      // picked up later in the day.
      const idleMinutes = Number(process.env.ADMIN_IDLE_MINUTES || 30);
      const lastUsed = session.last_used_at ? new Date(session.last_used_at).getTime() : NaN;
      if (Number.isFinite(lastUsed) && Date.now() - lastUsed > idleMinutes * 60_000) {
        await query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.id]);
        throw unauthenticated("Admin session locked after inactivity. Sign in again.");
      }
      await query(
        `UPDATE sessions
         SET last_used_at = now(),
             expires_at = GREATEST(expires_at, now() + make_interval(days => $2))
         WHERE id = $1`,
        [session.id, sessionDays(session.role)]
      );
    } else if (
      !session.last_used_at ||
      Date.now() - new Date(session.last_used_at).getTime() > 3600_000
    ) {
      // Farmers: every use (at most once an hour) pushes the end date out again,
      // so a farmer who keeps using the app stays signed in indefinitely.
      await query(
        `UPDATE sessions
         SET last_used_at = now(),
             expires_at = GREATEST(expires_at, now() + make_interval(days => $2))
         WHERE id = $1`,
        [session.id, sessionDays(session.role)]
      );
    }

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
