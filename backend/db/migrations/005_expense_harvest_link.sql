-- Let a spending be pinned to one harvest batch, so profit can be shown per
-- batch as well as per farm. The farm is still stored (and derived from the
-- batch) so farm totals keep working when a batch is used.
ALTER TABLE expenses
  ADD COLUMN harvest_id UUID,
  ADD COLUMN harvest_client_id TEXT;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_harvest_owner_fk
    FOREIGN KEY (harvest_id, farmer_id) REFERENCES harvests (id, farmer_id);

CREATE INDEX expenses_harvest_idx ON expenses (harvest_id);
