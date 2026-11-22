import { createApp } from "./app.js";
import { pool } from "./config/database.js";
import { pendingMigrations, runMigrations } from "./lib/migrations.js";

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";

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

await prepareDatabase();

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
