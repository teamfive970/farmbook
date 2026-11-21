import { pool } from "../src/config/database.js";
import { runMigrations } from "../src/lib/migrations.js";

async function main() {
  if (!pool) {
    console.error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.");
    process.exit(1);
  }
  await runMigrations(pool);
  console.log("Migrations complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool?.end());
