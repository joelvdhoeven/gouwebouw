/*
  # Add progress_percentage to time_registrations

  1. Changes
    - Add `progress_percentage` column to `time_registrations` table
      - Type: integer
      - Nullable: true (optional field)
      - Constraint: value must be between 0 and 100
    
  2. Purpose
    - Allow users to report project progress when submitting time registrations
    - This value will be used to update the project's progress_percentage
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_registrations' AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE time_registrations 
    ADD COLUMN progress_percentage integer 
    CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
  END IF;
END $$;