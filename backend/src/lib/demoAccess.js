import { query } from "../config/database.js";
import { encryptSecret } from "./crypto.js";
import { forbidden } from "./errors.js";
import { hashPin, verifyPin } from "./pin.js";
import { hashAccessCode, normalizeAccessCode } from "./tokens.js";

// A shared admin login for hackathon judges and testers.
//
// Set DEMO_ADMIN_ACCESS_CODE and DEMO_ADMIN_PIN on the server and:
//   * the server makes sure that admin exists with that PIN when it starts;
//   * the home page shows the code and PIN in a "For testers" box;
//   * that login cannot change its own code or PIN, and cannot send SMS.
// Delete the two variables to switch all of this off: the box disappears and,
// at the next start, the tester login is switched off and signed out.

export function demoAdminConfig() {
  const code = normalizeAccessCode(process.env.DEMO_ADMIN_ACCESS_CODE || "");
  const pin = String(process.env.DEMO_ADMIN_PIN || "").trim();
  if (!code || !/^\d{6}$/.test(pin)) return null;
  return {
    code,
    shownCode: String(process.env.DEMO_ADMIN_ACCESS_CODE).trim(),
    pin,
    name: (process.env.DEMO_ADMIN_NAME || "Demo admin (testers)").trim() || "Demo admin (testers)"
  };
}

// Any earlier tester login that is no longer the configured one (variables
// deleted, or a new code chosen) is switched off and signed out.
async function retireOldDemoAdmins(keepHash = null) {
  const { rows } = await query(
    `UPDATE admin_users SET status = 'inactive', updated_at = now()
     WHERE is_demo AND status = 'active' AND ($1::text IS NULL OR access_code_hash <> $1)
     RETURNING id`,
    [keepHash]
  );
  if (!rows.length) return;
  await query("UPDATE sessions SET revoked_at = now() WHERE admin_user_id = ANY($1::uuid[]) AND revoked_at IS NULL", [
    rows.map((row) => row.id)
  ]);
  console.log(`Old tester login switched off (${rows.length}).`);
}

export async function ensureDemoAdmin() {
  try {
    if (!process.env.DEMO_ADMIN_ACCESS_CODE && !process.env.DEMO_ADMIN_PIN) {
      await retireOldDemoAdmins();
      return;
    }
    const demo = demoAdminConfig();
    if (!demo) {
      console.warn(
        "DEMO_ADMIN_ACCESS_CODE / DEMO_ADMIN_PIN ignored: the code needs 6 to 40 letters, numbers or dashes and the PIN exactly 6 digits."
      );
      await retireOldDemoAdmins();
      return;
    }
    const hash = hashAccessCode(demo.code);
    await retireOldDemoAdmins(hash);
    const { rows } = await query("SELECT id, pin_hash, is_demo FROM admin_users WHERE access_code_hash = $1", [hash]);
    if (!rows[0]) {
      await query(
        `INSERT INTO admin_users (display_name, access_code_hash, access_code_ciphertext, pin_hash, is_demo)
         VALUES ($1, $2, $3, $4, true)`,
        [demo.name, hash, encryptSecret(demo.code), await hashPin(demo.pin)]
      );
      console.log(`Demo admin "${demo.name}" created. Its code and PIN are shown on the home page.`);
      return;
    }
    // Keep the shared login working: right PIN, active, not locked out.
    const pinHash = (await verifyPin(demo.pin, rows[0].pin_hash)) ? rows[0].pin_hash : await hashPin(demo.pin);
    await query(
      `UPDATE admin_users SET pin_hash = $2, status = 'active', is_demo = true, failed_login_count = 0,
         locked_until = NULL, updated_at = now()
       WHERE id = $1`,
      [rows[0].id, pinHash]
    );
    console.log("Demo admin is ready. Its code and PIN are shown on the home page.");
  } catch (error) {
    console.error("Could not set up the demo admin:", error.message);
  }
}

export async function isDemoAdmin(adminUserId) {
  if (!adminUserId) return false;
  const { rows } = await query("SELECT is_demo FROM admin_users WHERE id = $1", [adminUserId]);
  return rows[0]?.is_demo === true;
}

// Route guard: the shared tester login may look and try, but not lock others out.
export async function blockDemoAdmin(req) {
  if (req.auth?.role === "admin" && (await isDemoAdmin(req.auth.userId))) {
    throw forbidden("The shared tester login cannot change its access code or PIN.");
  }
}

// What the home page shows. Nothing at all unless the demo login is switched on.
export function publicDemoAccess() {
  const demo = demoAdminConfig();
  if (!demo) return { enabled: false };
  return { enabled: true, admin: { accessCode: demo.shownCode, pin: demo.pin, loginPath: "/admin/login" } };
}
