-- Photos: proof of a harvest (shown on its Harvest Passport when the passport
-- is public) and the farmer's profile photo. Stored in the database so they
-- work on Railway without extra storage. The phone shrinks each photo first
-- (about 1280 px, under 1 MB) and the server removes hidden data such as GPS
-- position before saving.
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('harvest', 'profile')),
  harvest_id UUID REFERENCES harvests (id) ON DELETE CASCADE,
  client_id TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/webp')),
  data BYTEA NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT photos_harvest_needed CHECK ((kind = 'harvest') = (harvest_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS photos_harvest_idx ON photos (harvest_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS photos_farmer_idx ON photos (farmer_id, created_at DESC);
-- A photo sent twice from the phone (for example after a network cut) is saved once.
CREATE UNIQUE INDEX IF NOT EXISTS photos_client_unique ON photos (farmer_id, client_id) WHERE client_id IS NOT NULL;

ALTER TABLE farmers ADD COLUMN IF NOT EXISTS photo_id UUID REFERENCES photos (id) ON DELETE SET NULL;
