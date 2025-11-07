/*
  # Add status column to time_registrations table

  1. Changes
    - Add `status` column to `time_registrations` table
    - Set default value to 'goedgekeurd' (approved)
    - Add check constraint for valid status values
    - Update existing rows to have the new status

  2. Security
    - No changes to RLS policies needed
*/

-- Add the status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_registrations' AND column_name = 'status'
  ) THEN
    ALTER TABLE time_registrations 
    ADD COLUMN status text DEFAULT 'goedgekeurd' NOT NULL;
    
    -- Add check constraint for valid status values
    ALTER TABLE time_registrations 
    ADD CONSTRAINT time_registrations_status_check 
    CHECK (status IN ('goedgekeurd', 'in-behandeling', 'afgekeurd', 'voltooid'));
    
    -- Update any existing rows to have the default status
    UPDATE time_registrations 
    SET status = 'goedgekeurd' 
    WHERE status IS NULL;
  END IF;
END $$;