/*
  # Add enabled column to email_schedules table

  1. Changes
    - Add `enabled` column to `email_schedules` table
    - Set default value to TRUE
    - Use safe approach to prevent errors if column already exists
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_schedules' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE email_schedules ADD COLUMN enabled BOOLEAN DEFAULT TRUE;
  END IF;
END $$;