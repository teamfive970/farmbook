import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, "../../db/migrations");

// Any fixed number works; it only stops two servers migrating at once
// (for example node --watch restarting while a migration is running).
const LOCK_ID = 74_210_331;

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function migrationFiles() {
  return (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
}

export async function pendingMigrations(pool) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name));
    return (await migrationFiles()).filter((file) => !applied.has(file));
  } finally {
    client.release();
  }
}

// Applies every migration that has not run yet, each in its own transaction.
export async function runMigrations(pool, { log = console.log } = {}) {
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await ensureTable(client);
    for (const file of await migrationFiles()) {
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (done.rowCount > 0) {
        log(`skip  ${file}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        error.message = `Migration ${file} failed: ${error.message}`;
        throw error;
      }
      applied.push(file);
      log(`apply ${file}`);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
  return applied;
}
