-- 010: admin access to farmer information is restricted and accountable.

-- Every audit row can now say WHY the admin did it and WHERE the request came
-- from. A reason is required before a farmer's record or phone number is shown,
-- and before any CSV is downloaded.
ALTER TABLE audit_logs
  ADD COLUMN reason TEXT,
  ADD COLUMN ip_address TEXT,
  ADD COLUMN user_agent TEXT;

CREATE INDEX audit_logs_action_time_idx ON audit_logs (action, created_at DESC);

-- The audit log is append-only. A stolen admin session must not be able to
-- rewrite or erase the trail of what it looked at and changed.
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'restrict_violation';
END
$$;

DROP TRIGGER IF EXISTS audit_logs_no_change ON audit_logs;
CREATE TRIGGER audit_logs_no_change
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

-- The application role usually owns the table, and an owner keeps its
-- privileges after REVOKE. Remove them as well, unless the role is a
-- superuser (a superuser ignores privileges; the trigger still stops changes).
DO $$
DECLARE
  role_is_super boolean;
BEGIN
  SELECT rolsuper INTO role_is_super FROM pg_roles WHERE rolname = current_user;
  IF role_is_super IS FALSE THEN
    EXECUTE format('REVOKE UPDATE, DELETE ON audit_logs FROM %I', current_user);
  END IF;
END
$$;

-- A group leader sees a member's totals only after that member agrees.
ALTER TABLE cooperative_members ADD COLUMN consent_at TIMESTAMPTZ;

CREATE INDEX cooperative_members_consent_idx ON cooperative_members (cooperative_id, consent_at);
