-- Minders initial relational schema.
-- Apply to a new PostgreSQL database with psql -f this-file.sql.

CREATE TABLE IF NOT EXISTS farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(160) NOT NULL,
  phone_number VARCHAR(32) NOT NULL UNIQUE,
  county VARCHAR(100) NOT NULL,
  district VARCHAR(120),
  pin_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  farm_name VARCHAR(160) NOT NULL,
  location VARCHAR(200),
  farm_type VARCHAR(20) NOT NULL
    CHECK (farm_type IN ('crop', 'livestock', 'mixed')),
  crop_or_livestock VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT farms_id_farmer_unique UNIQUE (id, farmer_id)
);

CREATE INDEX IF NOT EXISTS farms_farmer_id_idx ON farms(farmer_id);

CREATE TABLE IF NOT EXISTS farm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL,
  farmer_id UUID NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  activity_date DATE NOT NULL,
  description TEXT,
  input_used VARCHAR(160),
  quantity NUMERIC(12, 3),
  unit VARCHAR(40),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_farm_owner_fk
    FOREIGN KEY (farm_id, farmer_id)
    REFERENCES farms(id, farmer_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS activities_farmer_date_idx
  ON farm_activities(farmer_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS activities_farm_date_idx
  ON farm_activities(farm_id, activity_date DESC);