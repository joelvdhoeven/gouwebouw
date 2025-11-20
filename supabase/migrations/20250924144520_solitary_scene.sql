/*
  # Add missing type column to email_templates table

  1. Changes
    - Add 'type' column to email_templates table if it doesn't exist
    - Set default value to 'missing_hours'
    - Add constraint to only allow 'missing_hours' or 'weekly_overview' values

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'type'
  ) THEN
    ALTER TABLE email_templates 
    ADD COLUMN type TEXT NOT NULL DEFAULT 'missing_hours' 
    CHECK (type IN ('missing_hours', 'weekly_overview'));
  END IF;
END $$;