process.env.NODE_ENV = "test";
process.env.BCRYPT_COST = process.env.BCRYPT_COST || "4";
process.env.SESSION_DAYS = process.env.SESSION_DAYS || "7";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres@127.0.0.1:5433/minders_test";
process.env.DISABLE_RATE_LIMIT = "true";
process.env.CREDENTIAL_KEY =
  process.env.CREDENTIAL_KEY || "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

const { createApp } = await import("../src/app.js");
const { pool, query } = await import("../src/config/database.js");
const { encryptSecret } = await import("../src/lib/crypto.js");
const { hashPin } = await import("../src/lib/pin.js");
const { hashAccessCode, normalizeAccessCode } = await import("../src/lib/tokens.js");

export async function startServer() {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

export async function resetDatabase() {
  await query(
    "TRUNCATE TABLE audit_logs, recovery_otps, farm_activities, farms, sessions, admin_users, farmers CASCADE"
  );
}

export { query };

export async function closeDatabase() {
  await pool?.end();
}

export async function api(baseUrl, path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, body: json };
}

export async function createFarmerRecord(overrides = {}) {
  const pin = overrides.pin || "123456";
  const { rows } = await query(
    `INSERT INTO farmers (full_name, phone_number, county, district, community, pin_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      overrides.fullName || "Test Farmer",
      overrides.phoneNumber || "+231770001001",
      overrides.county || "Bong",
      overrides.district || "Gbarnga",
      overrides.community || "Gbarnga",
      await hashPin(pin),
      overrides.status || "active"
    ]
  );
  return { farmer: rows[0], pin };
}

export async function createAdminRecord(overrides = {}) {
  const pin = overrides.pin || "246810";
  const accessCode = normalizeAccessCode(overrides.accessCode || "MND-TESTADMIN");
  const { rows } = await query(
    `INSERT INTO admin_users
      (display_name, access_code_hash, access_code_ciphertext, phone_number, pin_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      overrides.displayName || "Test Admin",
      hashAccessCode(accessCode),
      encryptSecret(accessCode),
      overrides.phoneNumber === undefined ? "+231770009999" : overrides.phoneNumber,
      await hashPin(pin),
      overrides.status || "active"
    ]
  );
  return { admin: rows[0], pin, accessCode };
}

export async function loginAs(baseUrl, identifier, pin) {
  const result = await api(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { identifier, pin }
  });
  return result;
}
