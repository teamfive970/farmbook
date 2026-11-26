-- USSD and voice (IVR) channels.
--
-- 1. channel_sessions: one row per USSD session or phone call, from Africa's
--    Talking or the browser IVR simulator. Replaces the voice menu's
--    in-memory list, so calls survive a restart and work with more than one
--    backend. PINs are never stored here: after the PIN is checked the session
--    only remembers that it was.
CREATE TABLE IF NOT EXISTS channel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('ussd', 'voice')),
  provider TEXT NOT NULL CHECK (provider IN ('africastalking', 'simulator')),
  -- The provider's session id (for the simulator: a hash of its call token).
  session_key TEXT NOT NULL,
  phone_number TEXT,
  farmer_id UUID REFERENCES farmers (id) ON DELETE CASCADE,
  language TEXT,
  authenticated_at TIMESTAMPTZ,
  -- Keys pressed so far (PIN steps kept as "*" only), last screen, transcript.
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  CONSTRAINT channel_sessions_unique UNIQUE (channel, provider, session_key)
);
CREATE INDEX IF NOT EXISTS channel_sessions_open_idx ON channel_sessions (expires_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS channel_sessions_farmer_idx ON channel_sessions (farmer_id, created_at DESC);

-- 2. The farmer's language, kept on the account so the app, the voice menu
--    and USSD all know it (before, only the phone's browser knew it).
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farmers_language_check') THEN
    ALTER TABLE farmers ADD CONSTRAINT farmers_language_check CHECK (preferred_language ~ '^[a-z]{2,12}$');
  END IF;
END $$;

-- 3. Demo farmers, used only by the IVR simulator's demo mode. Their phone
--    numbers can't be dialled or typed in the app, and their records are left
--    out of the Ministry dashboard, market prices and messages to farmers.
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS farmers_demo_idx ON farmers (id) WHERE is_demo;
