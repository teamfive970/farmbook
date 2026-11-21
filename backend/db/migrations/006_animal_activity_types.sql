-- Animal farms need their own work types: breeding, health checks and
-- production records. Crop farms keep the crop work types already allowed.
ALTER TABLE farm_activities
  DROP CONSTRAINT IF EXISTS farm_activities_activity_type_check;

ALTER TABLE farm_activities
  ADD CONSTRAINT farm_activities_activity_type_check CHECK (
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
      'breeding',
      'health_check',
      'production',
      'other'
    )
  );
