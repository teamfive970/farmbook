-- Marks the shared tester login (DEMO_ADMIN_* variables, see lib/demoAccess.js),
-- so the server can switch it off by itself once those variables are removed.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
