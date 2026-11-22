import { createApp } from "./app.js";
import { ensureDemoAdmin } from "./lib/demoAccess.js";
import { pool } from "./config/database.js";
import { encryptSecret } from "./lib/crypto.js";
import { pendingMigrations, runMigrations } from "./lib/migrations.js";
import { normalizePhone } from "./lib/phone.js";
import { hashPin, validatePinFormat } from "./lib/pin.js";
import { hashAccessCode, normalizeAccessCode } from "./lib/tokens.js";

// On a hosting platform (Railway, Render, Docker) the server must listen on
// every network address, or the platform cannot reach it and answers 502.
// On a developer's computer it stays on 127.0.0.1 unless HOST says otherwise.
const onPlatform = Boolean(
  process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER
);
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || (onPlatform ? "0.0.0.0" : "127.0.0.1");

// Keep the database in step with the code. In development pending
// migrations are applied automatically; in production they are only applied
// when AUTO_MIGRATE=true (otherwise run `npm run migrate` during deploys).
async function prepareDatabase() {
  if (!pool) return;
  const autoMigrate =
    process.env.AUTO_MIGRATE === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.AUTO_MIGRATE !== "false");
  try {
    const pending = await pendingMigrations(pool);
    if (!pending.length) return;
    if (autoMigrate) {
      console.log(`Updating the database (${pending.length} migration${pending.length === 1 ? "" : "s"})…`);
      await runMigrations(pool);
      console.log("Database is up to date.");
    } else {
      console.warn(
        `WARNING: the database is missing ${pending.length} migration(s): ${pending.join(", ")}.\n` +
          "Run `npm run migrate` in the backend folder, then restart the server."
      );
    }
  } catch (error) {
    console.error("Could not check or update the database:", error.message);
  }
}

// Creates the first admin from ADMIN_ACCESS_CODE and ADMIN_PIN, so a new
// server can be set up from the hosting dashboard without a terminal.
// It only acts while the database has no admin at all, and never prints the PIN.
async function bootstrapAdmin() {
  if (!pool) return;
  const rawCode = process.env.ADMIN_ACCESS_CODE;
  const pin = process.env.ADMIN_PIN;
  if (!rawCode && !pin) return;
  const code = normalizeAccessCode(rawCode || "");
  if (!code || !pin || !validatePinFormat(pin) || pin.length !== 6) {
    console.warn(
      "ADMIN_ACCESS_CODE / ADMIN_PIN ignored: the code needs 6 to 40 letters, numbers or dashes (e.g. MND-7KQ2P9) and the PIN exactly 6 digits."
    );
    return;
  }
  try {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM admin_users");
    if (rows[0].n > 0) return;
    const name = (process.env.ADMIN_NAME || "Administrator").trim() || "Administrator";
    const phone = process.env.ADMIN_PHONE ? normalizePhone(process.env.ADMIN_PHONE) : null;
    await pool.query(
      `INSERT INTO admin_users (display_name, access_code_hash, access_code_ciphertext, phone_number, pin_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, hashAccessCode(code), encryptSecret(code), phone, await hashPin(pin)]
    );
    console.log(`First admin "${name}" created with access code ${code}. Sign in at /admin/login.`);
    console.log("You can now remove ADMIN_PIN from the server settings; the account keeps working.");
  } catch (error) {
    console.error("Could not create the first admin:", error.message);
  }
}

await prepareDatabase();
await bootstrapAdmin();
await ensureDemoAdmin();

const app = createApp();

const server = app.listen(port, host, () => {
  console.log(`FarmBok API listening on http://${host}:${port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down.`);
  server.close(async () => {
    await pool?.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
