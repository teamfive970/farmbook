-- 008: production records, following the Minders Farm Production Record
-- Management Guide: one farmer → many farms → each farm's crop plantings and
-- animal groups → every record linked to its farm (and planting or group).

-- A crop planting (one crop on one plot, from planting to the end of the
-- season) or an animal group (a batch of chickens, a herd of goats).
CREATE TABLE productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  farm_id UUID NOT NULL,
  farm_client_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('crop', 'animal')),
  name TEXT NOT NULL,                  -- the crop or animal, e.g. Cassava, Chicken
  variety TEXT,                        -- crop variety or animal breed
  label TEXT,                          -- the farmer's own name, e.g. "Upland plot", "Layers 2"
  plot TEXT,
  area NUMERIC(12, 2) CHECK (area IS NULL OR area >= 0),
  area_unit TEXT CHECK (area_unit IS NULL OR area_unit IN ('acres', 'hectares', 'lots', 'square_meters')),
  start_date DATE NOT NULL,            -- planting day, or the day the group started
  source TEXT CHECK (source IS NULL OR source IN ('own', 'bought', 'given', 'group', 'born')),
  method TEXT CHECK (method IS NULL OR method IN ('seeds', 'seedlings', 'cuttings', 'suckers', 'other')),
  start_count INTEGER CHECK (start_count IS NULL OR start_count >= 0),
  age_group TEXT CHECK (age_group IS NULL OR age_group IN ('young', 'grown', 'mixed')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT productions_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT productions_id_farmer_unique UNIQUE (id, farmer_id),
  CONSTRAINT productions_farm_owner_fk FOREIGN KEY (farm_id, farmer_id) REFERENCES farms (id, farmer_id) ON DELETE CASCADE
);
CREATE INDEX productions_farm_idx ON productions (farm_id) WHERE deleted_at IS NULL;

-- Changes to an animal group's count: births, buying, deaths (with the
-- cause), sales, eating, giving. Count now = start + in − out.
CREATE TABLE animal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  production_id UUID NOT NULL,
  production_client_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('born', 'bought', 'given_in', 'died', 'sold', 'eaten', 'given_out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  event_date DATE NOT NULL,
  cause TEXT CHECK (cause IS NULL OR cause IN ('sickness', 'accident', 'predator', 'weather', 'unknown', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT animal_events_client_unique UNIQUE (farmer_id, client_id),
  CONSTRAINT animal_events_production_fk FOREIGN KEY (production_id, farmer_id)
    REFERENCES productions (id, farmer_id) ON DELETE CASCADE
);
CREATE INDEX animal_events_production_idx ON animal_events (production_id) WHERE deleted_at IS NULL;

-- Work, harvests, costs and sales can name the planting or group they were for.
ALTER TABLE farm_activities
  ADD COLUMN production_id UUID,
  ADD COLUMN production_client_id TEXT,
  -- Mixed farms: where manure or crop leftovers came from (another planting
  -- or animal group of the same farmer), so it can be traced.
  ADD COLUMN source_production_id UUID,
  ADD COLUMN source_production_client_id TEXT,
  ADD CONSTRAINT farm_activities_production_fk FOREIGN KEY (production_id, farmer_id) REFERENCES productions (id, farmer_id),
  ADD CONSTRAINT farm_activities_source_fk FOREIGN KEY (source_production_id, farmer_id) REFERENCES productions (id, farmer_id);

ALTER TABLE harvests
  ADD COLUMN production_id UUID,
  ADD COLUMN production_client_id TEXT,
  ADD CONSTRAINT harvests_production_fk FOREIGN KEY (production_id, farmer_id) REFERENCES productions (id, farmer_id);

ALTER TABLE expenses
  ADD COLUMN production_id UUID,
  ADD COLUMN production_client_id TEXT,
  ADD CONSTRAINT expenses_production_fk FOREIGN KEY (production_id, farmer_id) REFERENCES productions (id, farmer_id);

ALTER TABLE sales
  ADD COLUMN production_id UUID,
  ADD COLUMN production_client_id TEXT,
  ADD CONSTRAINT sales_production_fk FOREIGN KEY (production_id, farmer_id) REFERENCES productions (id, farmer_id);

CREATE INDEX farm_activities_production_idx ON farm_activities (production_id) WHERE production_id IS NOT NULL;
CREATE INDEX harvests_production_idx ON harvests (production_id) WHERE production_id IS NOT NULL;
CREATE INDEX expenses_production_idx ON expenses (production_id) WHERE production_id IS NOT NULL;
CREATE INDEX sales_production_idx ON sales (production_id) WHERE production_id IS NOT NULL;

-- Crop monitoring (growth, pests, disease seen in the field) is its own work type.
ALTER TABLE farm_activities DROP CONSTRAINT IF EXISTS farm_activities_activity_type_check;
ALTER TABLE farm_activities
  ADD CONSTRAINT farm_activities_activity_type_check CHECK (
    activity_type IN (
      'land_preparation', 'planting', 'watering', 'fertilizer_application', 'pesticide_application',
      'weeding', 'monitoring', 'feeding', 'vaccination', 'cleaning', 'breeding', 'health_check',
      'production', 'other'
    )
  );

-- A farm can change type (a crop farm starts keeping chickens). Old records
-- are never changed or deleted; the change itself is written down here.
CREATE TABLE farm_type_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  from_type TEXT NOT NULL,
  to_type TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX farm_type_changes_farm_idx ON farm_type_changes (farm_id, changed_at);
