/*
  # Add Kilometers Field to Time Registrations

  1. Changes
    - Add `driven_kilometers` column to time_registrations table
    - Default value is 0 (no kilometers driven)
    - Field is optional (can be NULL or 0)

  2. Description
    This field captures kilometers driven that are:
    - NOT with a company car
    - NOT commute kilometers (woon-werk verkeer)
    - Personal car kilometers for work-related travel
*/

-- Add driven_kilometers column to time_registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_registrations' AND column_name = 'driven_kilometers'
  ) THEN
    ALTER TABLE time_registrations 
    ADD COLUMN driven_kilometers numeric(10,2) DEFAULT 0;
  END IF;
END $$;