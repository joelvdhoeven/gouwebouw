/*
  # Add CSV Separator Setting
  
  1. Changes
    - Add `csv_separator` column to `system_settings` table
    - Default value is semicolon (;) for Excel compatibility
    - Options: comma (,) or semicolon (;)
  
  2. Notes
    - Excel in European regions uses semicolon by default
    - This setting allows users to choose their preferred CSV format
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'csv_separator'
  ) THEN
    ALTER TABLE system_settings ADD COLUMN csv_separator text DEFAULT ';' CHECK (csv_separator IN (',', ';'));
  END IF;
END $$;
