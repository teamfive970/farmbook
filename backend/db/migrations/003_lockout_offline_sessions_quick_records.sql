-- Pre-pilot hardening and low-literacy record entry.
--  * Per-account lockout for PIN sign-in and for recovery-question answers, so a
--    PIN cannot be guessed by rotating IP addresses. Locks are short and lift on
--    their own; a successful recovery or an admin PIN reset clears them.
--  * Activity descriptions become optional: farmers can save a record with taps
--    only, and the app shows a summary built from the activity type and amount.

ALTER TABLE farmers
  ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN recovery_failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN recovery_locked_until TIMESTAMPTZ;

ALTER TABLE admin_users
  ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN recovery_failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN recovery_locked_until TIMESTAMPTZ;

ALTER TABLE farm_activities ALTER COLUMN description DROP NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);
