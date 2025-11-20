/*
  # Add Work Lines Support to Time Registrations

  1. Changes
    - Add `work_lines` column to time_registrations table (jsonb array)
    - This will store multiple work entries for a single time registration
    
  2. Structure
    - work_lines will be an array of objects: [{ werktype: string, werkomschrijving: string, aantal_uren: number }]
    - The existing werktype, werkomschrijving, and aantal_uren columns will be kept for backwards compatibility
    - New registrations will use work_lines, old ones will continue to use the single fields
*/

-- Add work_lines column to time_registrations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_registrations' AND column_name = 'work_lines'
  ) THEN
    ALTER TABLE time_registrations ADD COLUMN work_lines jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;