/*
  # Add missing status column to time_registrations table

  1. Changes
    - Add `status` column to `time_registrations` table
    - Set default value to 'in-behandeling'
    - Add check constraint for valid status values
    - Update any existing records to have default status

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

-- Add the status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_registrations' 
    AND column_name = 'status'
  ) THEN
    -- Add the status column with default value
    ALTER TABLE time_registrations 
    ADD COLUMN status text DEFAULT 'in-behandeling';
    
    -- Add check constraint to ensure only valid status values
    ALTER TABLE time_registrations 
    ADD CONSTRAINT time_registrations_status_check 
    CHECK (status IN ('goedgekeurd', 'in-behandeling', 'afgekeurd'));
    
    -- Update any existing records to have the default status
    UPDATE time_registrations 
    SET status = 'in-behandeling' 
    WHERE status IS NULL;
    
    -- Make the column NOT NULL after setting default values
    ALTER TABLE time_registrations 
    ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;