import { createApp } from "./app.js";
import { pool } from "./config/database.js";

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";
const app = createApp();

const server = app.listen(port, host, () => {
  console.log(`Minders API listening on http://${host}:${port}`);
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
