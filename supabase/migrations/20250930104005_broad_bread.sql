/*
  # Add status column to time_registrations table

  1. Changes
    - Add `status` column to `time_registrations` table
    - Set default value to 'goedgekeurd' (approved) as per new workflow
    - Add check constraint to ensure valid status values
    - Update existing rows to have 'goedgekeurd' status

  2. Security
    - No RLS changes needed as column is added to existing table with existing policies
*/

-- Add status column with default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_registrations' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.time_registrations 
    ADD COLUMN status text DEFAULT 'goedgekeurd' NOT NULL;
    
    -- Add check constraint for valid status values
    ALTER TABLE public.time_registrations 
    ADD CONSTRAINT time_registrations_status_check 
    CHECK (status = ANY (ARRAY['goedgekeurd'::text, 'in-behandeling'::text, 'afgekeurd'::text, 'voltooid'::text]));
    
    -- Update any existing rows to have 'goedgekeurd' status
    UPDATE public.time_registrations 
    SET status = 'goedgekeurd' 
    WHERE status IS NULL;
  END IF;
END $$;