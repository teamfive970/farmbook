import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
    })
  : null;

export async function checkDatabase() {
  if (!pool) {
    const error = new Error("DATABASE_URL is not configured");
    error.code = "DATABASE_NOT_CONFIGURED";
    throw error;
  }
  const result = await pool.query("SELECT 1 AS connected");
  return result.rows[0].connected === 1;
}