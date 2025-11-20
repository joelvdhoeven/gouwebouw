/*
  # Add missing status column to time_registrations table

  1. Changes
    - Add `status` column to `time_registrations` table with type `registration_status`
    - Set default value to 'in-behandeling'
    - Update existing records to have 'in-behandeling' status if they don't have one

  This fixes the "column status does not exist" error when inserting time registrations.
*/

-- Add the status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_registrations' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE time_registrations 
    ADD COLUMN status registration_status DEFAULT 'in-behandeling'::registration_status NOT NULL;
    
    -- Update any existing records that might not have a status
    UPDATE time_registrations 
    SET status = 'in-behandeling'::registration_status 
    WHERE status IS NULL;
  END IF;
END $$;