/*
  # Add event column to email_schedules table

  1. New Columns
    - `event` (email_event enum, NOT NULL)
      - Enum values: document_processed, document_failed, daily_summary, weekly_summary
      - Default: 'daily_summary'

  2. Changes
    - Creates email_event enum type if it doesn't exist
    - Adds event column with proper constraints
    - Uses safe approach to prevent errors if run multiple times
*/

-- Create the email_event enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_event') THEN
        CREATE TYPE email_event AS ENUM (
            'document_processed',
            'document_failed', 
            'daily_summary',
            'weekly_summary'
        );
    END IF;
END $$;

-- Add the event column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_schedules' AND column_name = 'event'
    ) THEN
        ALTER TABLE email_schedules 
        ADD COLUMN event email_event NOT NULL DEFAULT 'daily_summary';
    END IF;
END $$;