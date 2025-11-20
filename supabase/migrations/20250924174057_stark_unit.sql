/*
  # Make email_logs.user_id nullable

  1. Changes
    - Make user_id column in email_logs table nullable to support test emails
    - This allows logging of test emails that aren't associated with a specific user

  2. Security
    - No changes to RLS policies needed
    - Existing policies will continue to work correctly
*/

-- Make user_id nullable in email_logs table
ALTER TABLE public.email_logs ALTER COLUMN user_id DROP NOT NULL;