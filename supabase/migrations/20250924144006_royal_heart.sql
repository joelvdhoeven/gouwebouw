/*
  # Add missing body column to email_templates table

  1. Changes
    - Add 'body' column to email_templates table
    - Column is TEXT type and NOT NULL
    - Set default value for existing rows if any

  This fixes the PGRST204 error where the frontend expects a 'body' column
  that doesn't exist in the current database schema.
*/

-- Add the missing body column to email_templates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'body'
  ) THEN
    ALTER TABLE public.email_templates ADD COLUMN body TEXT NOT NULL DEFAULT '';
  END IF;
END $$;