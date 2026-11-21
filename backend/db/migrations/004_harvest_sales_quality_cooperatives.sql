-- Phase 2: farm size, harvest batches, quality grading, buyers, sales, payments,
-- expenses, Harvest Passport (QR traceability) and cooperatives.
--
-- Every farmer-owned record is created on the phone first, so each has a
-- client_id (idempotency key, unique per farmer) and is soft-deleted
-- (deleted_at) so deletes sync safely. Records point at each other by the
-- parent's client_id as well as its server id, so a chain made offline
-- (harvest -> sale -> payment) syncs without remapping temporary ids.

ALTER TABLE farms
  ADD COLUMN size NUMERIC(12, 2) CHECK (size IS NULL OR size >= 0),
  ADD COLUMN size_unit TEXT CHECK (
    size_unit IS NULL OR size_unit IN ('acres', 'hectares', 'lots', 'square_meters')
  );

CREATE TABLE harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  farm_id UUID NOT NULL,
  farm_client_id TEXT NOT NULL,
  crop TEXT NOT NULL,
  harvest_date DATE NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  storage TEXT,
  notes TEXT,
  passport_code TEXT NOT NULL UNIQUE,
  passport_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT harvests_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT harvests_id_farmer_unique UNIQUE (id, farmer_id),
  CONSTRAINT harvests_farm_owner_fk
    FOREIGN KEY (farm_id, farmer_id) REFERENCES farms (id, farmer_id) ON DELETE CASCADE
);
CREATE INDEX harvests_farmer_date_idx ON harvests (farmer_id, harvest_date DESC);
CREATE INDEX harvests_farm_idx ON harvests (farm_id);

CREATE TABLE quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  harvest_id UUID NOT NULL,
  harvest_client_id TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'rejected')),
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  moisture_percent NUMERIC(5, 2) CHECK (moisture_percent IS NULL OR (moisture_percent >= 0 AND moisture_percent <= 100)),
  inspector TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT inspections_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT inspections_harvest_owner_fk
    FOREIGN KEY (harvest_id, farmer_id) REFERENCES harvests (id, farmer_id) ON DELETE CASCADE
);
CREATE INDEX inspections_harvest_idx ON quality_inspections (harvest_id);

CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  buyer_type TEXT NOT NULL DEFAULT 'other' CHECK (
    buyer_type IN ('market_woman', 'trader', 'cooperative', 'company', 'neighbor', 'other')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT buyers_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT buyers_id_farmer_unique UNIQUE (id, farmer_id)
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  harvest_id UUID,
  harvest_client_id TEXT,
  buyer_id UUID,
  buyer_client_id TEXT,
  sale_date DATE NOT NULL,
  crop TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  unit_price NUMERIC(14, 2) CHECK (unit_price IS NULL OR unit_price >= 0),
  total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('LRD', 'USD')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT sales_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT sales_id_farmer_unique UNIQUE (id, farmer_id),
  CONSTRAINT sales_harvest_owner_fk
    FOREIGN KEY (harvest_id, farmer_id) REFERENCES harvests (id, farmer_id),
  CONSTRAINT sales_buyer_owner_fk
    FOREIGN KEY (buyer_id, farmer_id) REFERENCES buyers (id, farmer_id)
);
CREATE INDEX sales_farmer_date_idx ON sales (farmer_id, sale_date DESC);
CREATE INDEX sales_harvest_idx ON sales (harvest_id);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  sale_id UUID NOT NULL,
  sale_client_id TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  paid_date DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'mobile_money', 'bank', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT payments_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT payments_sale_owner_fk
    FOREIGN KEY (sale_id, farmer_id) REFERENCES sales (id, farmer_id) ON DELETE CASCADE
);
CREATE INDEX payments_sale_idx ON payments (sale_id);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  farm_id UUID,
  farm_client_id TEXT,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('seeds', 'fertilizer', 'pesticide', 'labour', 'tools', 'transport', 'feed', 'medicine', 'land', 'other')
  ),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('LRD', 'USD')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT expenses_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT expenses_farm_owner_fk
    FOREIGN KEY (farm_id, farmer_id) REFERENCES farms (id, farmer_id)
);
CREATE INDEX expenses_farmer_date_idx ON expenses (farmer_id, expense_date DESC);

CREATE TABLE cooperatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  county TEXT NOT NULL,
  district TEXT,
  community TEXT,
  description TEXT,
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cooperative_members (
  cooperative_id UUID NOT NULL REFERENCES cooperatives (id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cooperative_id, farmer_id)
);
CREATE INDEX cooperative_members_farmer_idx ON cooperative_members (farmer_id);
