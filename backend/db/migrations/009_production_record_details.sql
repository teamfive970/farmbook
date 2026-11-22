-- 009: the extra details the Farm Production Record Management Guide asks for.

-- Crop planting: how far apart the plants are. Animal group: the tag or ID
-- number the farmer uses for it.
ALTER TABLE productions
  ADD COLUMN spacing TEXT,
  ADD COLUMN tag_number TEXT;

-- What the farmer saw or did, kept with the work record. Each one belongs to
-- one kind of work (crop check, feeding, health, vaccination, breeding), so
-- every column is optional.
ALTER TABLE farm_activities
  ADD COLUMN growth_stage TEXT,
  ADD COLUMN pests TEXT,
  ADD COLUMN diseases TEXT,
  ADD COLUMN feed_schedule TEXT,
  ADD COLUMN animal_disease TEXT,
  ADD COLUMN symptoms TEXT,
  ADD COLUMN treatment TEXT,
  ADD COLUMN vet_visit TEXT,
  ADD COLUMN pregnancy TEXT;

ALTER TABLE farm_activities
  ADD CONSTRAINT farm_activities_growth_stage_check
    CHECK (growth_stage IS NULL OR growth_stage IN ('seedling', 'growing', 'flowering', 'fruiting', 'ready')),
  ADD CONSTRAINT farm_activities_feed_schedule_check
    CHECK (feed_schedule IS NULL OR feed_schedule IN ('once_a_day', 'twice_a_day', 'three_times_a_day', 'all_day', 'other')),
  ADD CONSTRAINT farm_activities_pregnancy_check
    CHECK (pregnancy IS NULL OR pregnancy IN ('not_sure', 'pregnant', 'not_pregnant'));

-- A birth can say how many were male and how many female.
ALTER TABLE animal_events
  ADD COLUMN male_count INTEGER CHECK (male_count IS NULL OR male_count >= 0),
  ADD COLUMN female_count INTEGER CHECK (female_count IS NULL OR female_count >= 0);

-- A visit from the vet is its own cost.
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_category_check CHECK (
    category IN (
      'seeds', 'fertilizer', 'pesticide', 'labour', 'tools', 'transport',
      'feed', 'medicine', 'veterinary', 'land', 'other'
    )
  );
