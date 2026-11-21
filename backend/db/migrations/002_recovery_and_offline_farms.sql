-- Account recovery, secure admin access-code reveal, and offline farm creation.

ALTER TABLE farmers
  ADD COLUMN security_question TEXT,
  ADD COLUMN security_answer_hash TEXT;

ALTER TABLE admin_users
  ADD COLUMN security_question TEXT,
  ADD COLUMN security_answer_hash TEXT,
  ADD COLUMN access_code_ciphertext TEXT;

-- Farms can now be created on a device before they reach the server.
-- client_id is the device-generated idempotency key. Existing farms receive
-- their server id so every farm has a stable client-facing identifier.
ALTER TABLE farms ADD COLUMN client_id TEXT;
UPDATE farms SET client_id = id::text WHERE client_id IS NULL;
ALTER TABLE farms
  ADD CONSTRAINT farms_farmer_client_unique UNIQUE (farmer_id, client_id);

CREATE TABLE recovery_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('farmer', 'admin')),
  farmer_id UUID REFERENCES farmers (id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recovery_otps_owner_check CHECK (
    (role = 'farmer' AND farmer_id IS NOT NULL AND admin_user_id IS NULL) OR
    (role = 'admin' AND admin_user_id IS NOT NULL AND farmer_id IS NULL)
  )
);

CREATE INDEX recovery_otps_farmer_idx ON recovery_otps (farmer_id, created_at DESC);
CREATE INDEX recovery_otps_admin_idx ON recovery_otps (admin_user_id, created_at DESC);
CREATE INDEX recovery_otps_expiry_idx ON recovery_otps (expires_at);
