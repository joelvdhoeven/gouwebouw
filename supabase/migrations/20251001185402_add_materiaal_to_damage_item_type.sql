/*
  # Add materiaal type to damage_item_type enum
  
  1. Changes
    - Add 'materiaal' value to damage_item_type enum
    - This allows users to report damage to materials as well as buses and tools
  
  2. Notes
    - Uses ALTER TYPE to extend the enum
    - Safe operation - does not affect existing data
*/

-- Add 'materiaal' to the damage_item_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'materiaal' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'damage_item_type')
  ) THEN
    ALTER TYPE damage_item_type ADD VALUE 'materiaal';
  END IF;
END $$;