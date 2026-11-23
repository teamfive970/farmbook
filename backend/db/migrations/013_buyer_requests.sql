-- "Contact this farmer": a buyer who scanned a Harvest Passport leaves their
-- name and number. The farmer sees the request in the app (and by SMS if they
-- allow it) and decides: call back, share their own number, or decline.
-- The farmer's number is never shown to the buyer unless the farmer shares it.

CREATE TABLE buyer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  harvest_id UUID NOT NULL REFERENCES harvests (id) ON DELETE CASCADE,
  passport_code TEXT NOT NULL,
  crop TEXT NOT NULL,
  buyer_name TEXT NOT NULL CHECK (char_length(buyer_name) BETWEEN 2 AND 80),
  buyer_phone TEXT NOT NULL,
  buyer_org TEXT CHECK (buyer_org IS NULL OR char_length(buyer_org) <= 80),
  quantity_wanted NUMERIC(14, 2) CHECK (quantity_wanted IS NULL OR quantity_wanted > 0),
  message TEXT CHECK (message IS NULL OR char_length(message) <= 300),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'shared', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX buyer_requests_farmer_idx ON buyer_requests (farmer_id, created_at DESC);
CREATE INDEX buyer_requests_repeat_idx ON buyer_requests (harvest_id, buyer_phone, created_at DESC);
