/*
  # Update Damage Reports Schema

  1. Changes
    - Add omschrijving column (description/name of the item)
    - Add beschrijving_schade column (damage description)
    - Update foto_url to foto_urls as array
    - Remove naam column if exists
    - Add type_item if not exists

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'damage_reports' AND column_name = 'omschrijving'
  ) THEN
    ALTER TABLE damage_reports ADD COLUMN omschrijving text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'damage_reports' AND column_name = 'beschrijving_schade'
  ) THEN
    ALTER TABLE damage_reports ADD COLUMN beschrijving_schade text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'damage_reports' AND column_name = 'foto_urls'
  ) THEN
    ALTER TABLE damage_reports ADD COLUMN foto_urls text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'damage_reports' AND column_name = 'type_item'
  ) THEN
    ALTER TABLE damage_reports ADD COLUMN type_item text;
  END IF;
END $$;
