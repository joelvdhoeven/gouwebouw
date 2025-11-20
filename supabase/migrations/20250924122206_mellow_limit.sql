/*
  # Add status column to time_registrations table

  1. Changes
    - Add `status` column to `time_registrations` table
    - Set default value to 'in-behandeling'
    - Add check constraint for valid status values
    - Update existing records with default status

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

-- Check if status column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_registrations' 
    AND column_name = 'status'
  ) THEN
    -- Add the status column
    ALTER TABLE time_registrations 
    ADD COLUMN status TEXT DEFAULT 'in-behandeling';
    
    -- Add check constraint for valid status values
    ALTER TABLE time_registrations 
    ADD CONSTRAINT time_registrations_status_check 
    CHECK (status IN ('goedgekeurd', 'in-behandeling', 'afgekeurd'));
    
    -- Update any existing records to have the default status
    UPDATE time_registrations 
    SET status = 'in-behandeling' 
    WHERE status IS NULL;
    
    -- Make the column NOT NULL after updating existing records
    ALTER TABLE time_registrations 
    ALTER COLUMN status SET NOT NULL;
    
  END IF;
END $$;