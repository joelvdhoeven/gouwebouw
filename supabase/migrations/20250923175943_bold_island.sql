/*
  # Add status column to time_registrations table

  1. Changes
    - Add `status` column to `time_registrations` table
    - Set default value to 'in-behandeling'
    - Add check constraint for valid status values
    - Update any existing records to have the default status

  2. Security
    - No RLS changes needed as column is being added to existing table

  This migration adds the missing status column that the frontend expects.
*/

-- First, check if the column already exists and add it if it doesn't
DO $$
BEGIN
    -- Check if status column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'time_registrations' 
        AND column_name = 'status'
    ) THEN
        -- Add the status column with default value
        ALTER TABLE public.time_registrations 
        ADD COLUMN status text DEFAULT 'in-behandeling';
        
        -- Add check constraint for valid status values
        ALTER TABLE public.time_registrations 
        ADD CONSTRAINT time_registrations_status_check 
        CHECK (status IN ('goedgekeurd', 'in-behandeling', 'afgekeurd'));
        
        -- Update any existing records to have the default status
        UPDATE public.time_registrations 
        SET status = 'in-behandeling' 
        WHERE status IS NULL;
        
        -- Make the column NOT NULL after updating existing records
        ALTER TABLE public.time_registrations 
        ALTER COLUMN status SET NOT NULL;
        
        RAISE NOTICE 'Status column added to time_registrations table successfully';
    ELSE
        RAISE NOTICE 'Status column already exists in time_registrations table';
    END IF;
END $$;