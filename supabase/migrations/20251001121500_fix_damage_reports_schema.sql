/*
  # Fix damage_reports schema
  
  1. Changes
    - Make `naam` column nullable (currently NOT NULL but not used by app)
    - Make `beschrijving` column nullable (currently NOT NULL but not used by app)
    - Keep `omschrijving` and `beschrijving_schade` as the primary fields used by the app
  
  2. Notes
    - This aligns the database schema with the actual application usage
    - The app uses `omschrijving` and `beschrijving_schade` for damage reports
*/

-- Make naam and beschrijving nullable
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'damage_reports' AND column_name = 'naam' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE damage_reports ALTER COLUMN naam DROP NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'damage_reports' AND column_name = 'beschrijving' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE damage_reports ALTER COLUMN beschrijving DROP NOT NULL;
  END IF;
END $$;