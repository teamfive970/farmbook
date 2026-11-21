import "dotenv/config";
import pg from "pg";

const { Pool, types } = pg;

// DATE columns come back as plain "YYYY-MM-DD" text. Turning them into JS
// Dates would shift the day when the server is not on UTC.
types.setTypeParser(1082, (value) => value);

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: 10,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    })
  : null;

function databaseUnavailable() {
  const error = new Error("The database is not available.");
  error.status = 503;
  error.code = "DATABASE_UNAVAILABLE";
  return error;
}

export async function query(text, params) {
  if (!pool) throw databaseUnavailable();
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  if (!pool) throw databaseUnavailable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!pool) throw databaseUnavailable();
  const result = await pool.query("SELECT 1 AS connected");
  return result.rows[0].connected === 1;
}
