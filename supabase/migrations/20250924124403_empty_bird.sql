/*
  # Fix time_registrations status column

  This migration ensures the status column exists in the time_registrations table
  with proper constraints and default values.

  1. Schema Changes
     - Add status column if it doesn't exist
     - Set proper enum type and default value
     - Add check constraint for valid status values

  2. Data Migration
     - Update any existing records without status to have default value

  3. Security
     - Maintain existing RLS policies
*/

-- First, create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE registration_status AS ENUM ('goedgekeurd', 'in-behandeling', 'afgekeurd');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    END IF;
END $$;

-- Update any existing records that might have null status
UPDATE time_registrations 
SET status = 'in-behandeling'::registration_status 
WHERE status IS NULL;

-- Ensure the column has the correct constraint
ALTER TABLE time_registrations 
ALTER COLUMN status SET DEFAULT 'in-behandeling'::registration_status;

ALTER TABLE time_registrations 
ALTER COLUMN status SET NOT NULL;