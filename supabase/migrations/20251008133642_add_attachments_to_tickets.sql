/*
  # Add Attachments to Tickets

  1. Changes
    - Add `attachments` column to tickets table (jsonb array)
    - This will store file URLs and metadata for uploaded files
    
  2. Structure
    - attachments will be an array of objects: [{ name: string, url: string, type: string, size: number }]
*/

-- Add attachments column to tickets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE tickets ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;