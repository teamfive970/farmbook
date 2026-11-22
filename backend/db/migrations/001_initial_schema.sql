-- FarmBok core MVP schema
-- Roles: farmer (self-registered) and admin (provisioned only, never public).

CREATE TABLE farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  county TEXT NOT NULL,
  district TEXT NOT NULL,
  community TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  access_code_hash TEXT NOT NULL UNIQUE,
  phone_number TEXT UNIQUE,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('farmer', 'admin')),
  farmer_id UUID REFERENCES farmers (id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  CONSTRAINT sessions_owner_check CHECK (
    (role = 'farmer' AND farmer_id IS NOT NULL AND admin_user_id IS NULL) OR
    (role = 'admin' AND admin_user_id IS NOT NULL AND farmer_id IS NULL)
  )
);

CREATE INDEX sessions_farmer_idx ON sessions (farmer_id);
CREATE INDEX sessions_admin_idx ON sessions (admin_user_id);

CREATE TABLE farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  farm_name TEXT NOT NULL,
  county TEXT NOT NULL,
  district TEXT NOT NULL,
  community TEXT NOT NULL,
  farm_type TEXT NOT NULL CHECK (
    farm_type IN ('crop_farming', 'livestock', 'poultry', 'mixed_farming', 'other')
  ),
  main_crop_or_livestock TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT farms_id_farmer_unique UNIQUE (id, farmer_id)
);

CREATE INDEX farms_farmer_idx ON farms (farmer_id);

CREATE TABLE farm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  farm_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'land_preparation',
      'planting',
      'watering',
      'fertilizer_application',
      'pesticide_application',
      'weeding',
      'feeding',
      'vaccination',
      'cleaning',
      'other'
    )
  ),
  activity_date DATE NOT NULL,
  description TEXT NOT NULL,
  input_used TEXT,
  quantity NUMERIC(12, 2) CHECK (quantity IS NULL OR quantity >= 0),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT farm_activities_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT farm_activities_farm_owner_fk
    FOREIGN KEY (farm_id, farmer_id) REFERENCES farms (id, farmer_id) ON DELETE CASCADE
);

CREATE INDEX farm_activities_farmer_date_idx
  ON farm_activities (farmer_id, activity_date DESC, created_at DESC);
CREATE INDEX farm_activities_farm_idx ON farm_activities (farm_id);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_admin_idx ON audit_logs (admin_user_id, created_at DESC);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id);
