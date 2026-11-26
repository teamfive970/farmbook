-- "Share my record with a lender": the farmer makes a private link that shows
-- a summary of their farm records (money in and out by month, harvests, how
-- well they keep records). The farmer chooses whether the lender sees their
-- name and phone, how long the link works, and can stop it at any time.
CREATE TABLE IF NOT EXISTS credit_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  lender_name TEXT,
  include_contact BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS credit_shares_farmer_idx ON credit_shares (farmer_id, created_at DESC);
