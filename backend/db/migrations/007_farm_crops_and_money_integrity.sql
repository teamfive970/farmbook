-- 007: farms list every crop/animal they grow, and indexes for the checks
-- that stop over-selling a harvest or over-paying a sale.

-- Each farm keeps a list of what it grows or raises. A harvest can only be
-- for one of these. Existing farms are filled from the old free-text field
-- ("Rice, Cassava" or "Cassava and rice" become two entries).
ALTER TABLE farms ADD COLUMN IF NOT EXISTS crops TEXT[] NOT NULL DEFAULT '{}';

UPDATE farms f
SET crops = COALESCE((
  SELECT array_agg(DISTINCT upper(left(trim(part), 1)) || substr(trim(part), 2))
  FROM regexp_split_to_table(f.main_crop_or_livestock, '\s*(,|&|/|\mand\M)\s*', 'i') AS part
  WHERE trim(part) <> ''
), '{}')
WHERE f.crops = '{}' AND f.main_crop_or_livestock IS NOT NULL AND trim(f.main_crop_or_livestock) <> '';

-- Sum of what was sold from a batch, and of what was paid on a sale, are
-- checked inside the same transaction that writes a new sale or payment.
CREATE INDEX IF NOT EXISTS sales_harvest_active_idx ON sales (harvest_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_sale_active_idx ON payments (sale_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS inspections_harvest_active_idx ON quality_inspections (harvest_id) WHERE deleted_at IS NULL;
