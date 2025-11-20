/*
  # Add missing status column to time_registrations table

  1. Changes
    - Add status column to time_registrations table with registration_status enum type
    - Set default value to 'in-behandeling'
    - Add check constraint to ensure valid status values

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

-- Add the status column to time_registrations table
ALTER TABLE public.time_registrations 
ADD COLUMN IF NOT EXISTS status registration_status NOT NULL DEFAULT 'in-behandeling'::registration_status;

-- Add check constraint to ensure valid status values (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'time_registrations' 
    AND constraint_name = 'time_registrations_status_check'
  ) THEN
    ALTER TABLE public.time_registrations 
    ADD CONSTRAINT time_registrations_status_check 
    CHECK (status IN ('goedgekeurd'::registration_status, 'in-behandeling'::registration_status, 'afgekeurd'::registration_status));
  END IF;
END $$;