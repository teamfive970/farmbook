-- Farm location for the Harvest Passport map.
--
-- The farmer saves the GPS point while standing on the farm. Buyers see it
-- only when the farmer turns on "show my farm on the map", and then only
-- rounded to about 1 km, so the exact spot (often the family home) stays private.

ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS location_accuracy_m INTEGER,
  ADD COLUMN IF NOT EXISTS location_saved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS show_on_map BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE farms DROP CONSTRAINT IF EXISTS farms_location_check;
ALTER TABLE farms ADD CONSTRAINT farms_location_check CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);
