/*
  # Add missing columns to email_schedules table

  1. Missing Columns
    - `day_of_week` (integer) - Day of the week (0-6, Sunday-Saturday)
    - `hour` (integer) - Hour of the day (0-23)
    - `schedule_type` (text) - Type of schedule (weekly/daily)
    - `minimum_hours` (integer) - Minimum hours threshold
    - `target_roles` (text array) - Target user roles

  2. Safety
    - Uses IF NOT EXISTS checks to prevent errors on re-run
    - Adds appropriate default values
    - Includes constraints for data validation
*/

-- Add day_of_week column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_schedules' AND column_name = 'day_of_week'
  ) THEN
    ALTER TABLE email_schedules ADD COLUMN day_of_week integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add hour column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_schedules' AND column_name = 'hour'
  ) THEN
    ALTER TABLE email_schedules ADD COLUMN hour integer NOT NULL DEFAULT 9;
  END IF;
END $$;

-- Add schedule_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_schedules' AND column_name = 'schedule_type'
  ) THEN
    ALTER TABLE email_schedules ADD COLUMN schedule_type text NOT NULL DEFAULT 'weekly';
  END IF;
END $$;

-- Add minimum_hours column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_schedules' AND column_name = 'minimum_hours'
  ) THEN
    ALTER TABLE email_schedules ADD COLUMN minimum_hours integer NOT NULL DEFAULT 40;
  END IF;
END $$;

-- Add target_roles column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_schedules' AND column_name = 'target_roles'
  ) THEN
    ALTER TABLE email_schedules ADD COLUMN target_roles text[] NOT NULL DEFAULT ARRAY['medewerker'];
  END IF;
END $$;

-- Add constraints
DO $$
BEGIN
  -- Check constraint for day_of_week (0-6)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'email_schedules_day_of_week_check'
  ) THEN
    ALTER TABLE email_schedules ADD CONSTRAINT email_schedules_day_of_week_check 
    CHECK (day_of_week >= 0 AND day_of_week <= 6);
  END IF;

  -- Check constraint for hour (0-23)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'email_schedules_hour_check'
  ) THEN
    ALTER TABLE email_schedules ADD CONSTRAINT email_schedules_hour_check 
    CHECK (hour >= 0 AND hour <= 23);
  END IF;

  -- Check constraint for schedule_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'email_schedules_schedule_type_check'
  ) THEN
    ALTER TABLE email_schedules ADD CONSTRAINT email_schedules_schedule_type_check 
    CHECK (schedule_type IN ('weekly', 'daily'));
  END IF;

  -- Check constraint for minimum_hours
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'email_schedules_minimum_hours_check'
  ) THEN
    ALTER TABLE email_schedules ADD CONSTRAINT email_schedules_minimum_hours_check 
    CHECK (minimum_hours >= 0);
  END IF;
END $$;