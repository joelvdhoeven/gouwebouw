/*
  # Add Materials to Time Registrations

  1. Changes
    - Add materials column to time_registrations table
    - Column stores JSON array of materials used for Regie/Meerwerk work types

  2. Structure
    - materials: JSONB array containing:
      - product_id: UUID of the product
      - product_name: Name of the product
      - quantity: Amount used
      - unit: Unit of measurement
*/

-- Add materials column to time_registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_registrations' AND column_name = 'materials'
  ) THEN
    ALTER TABLE time_registrations ADD COLUMN materials JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;