-- Weekly market prices by SMS. Farmers switch it on themselves (off by
-- default, because SMS can cost them or the programme money).
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS price_sms BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_sms_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS farmers_price_sms_idx ON farmers (county) WHERE price_sms;
