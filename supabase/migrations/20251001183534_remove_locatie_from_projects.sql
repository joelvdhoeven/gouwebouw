/*
  # Remove locatie field from projects table

  1. Changes
    - Remove the `locatie` column from the `projects` table
    - This field is no longer required for project management
  
  2. Notes
    - Existing data in the `locatie` column will be permanently deleted
    - This change aligns with the updated project requirements
    - Projects can now be created without specifying a location
*/

-- Drop the locatie column from projects table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'locatie'
  ) THEN
    ALTER TABLE projects DROP COLUMN locatie;
  END IF;
END $$;
