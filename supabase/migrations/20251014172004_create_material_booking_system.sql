/*
  # Material Booking System for Time Registrations

  1. Overview
    - Automatically create inventory transactions when time registrations with materials are created
    - Only for materials of type 'product' (not 'description')
    - Deduct from inventory stock when materials are used
    - Link transactions to the project and user

  2. Changes
    - Add function to process materials from time registration
    - Add trigger to automatically process materials on insert

  3. Notes
    - Only processes materials with type = 'product' and valid product_id
    - Creates 'out' transaction type for each material
    - Links to project_id from the time registration
*/

-- Function to process materials from time registration
CREATE OR REPLACE FUNCTION process_time_registration_materials()
RETURNS TRIGGER AS $$
DECLARE
  material_item jsonb;
  default_location_id uuid;
BEGIN
  -- Only process if materials exist and is an array
  IF NEW.materials IS NOT NULL AND jsonb_typeof(NEW.materials) = 'array' THEN
    
    -- Get a default location (first available location)
    -- In production, you might want to specify which location to deduct from
    SELECT id INTO default_location_id 
    FROM inventory_locations 
    LIMIT 1;
    
    -- If no location exists, skip processing
    IF default_location_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Loop through each material
    FOR material_item IN SELECT * FROM jsonb_array_elements(NEW.materials)
    LOOP
      -- Only process materials of type 'product' with valid product_id
      IF (material_item->>'type')::text = 'product' 
         AND (material_item->>'product_id')::text IS NOT NULL 
         AND (material_item->>'product_id')::text != ''
         AND (material_item->>'quantity')::decimal > 0 THEN
        
        -- Create inventory transaction (deduct from stock)
        INSERT INTO inventory_transactions (
          product_id,
          location_id,
          project_id,
          user_id,
          transaction_type,
          quantity,
          notes
        ) VALUES (
          (material_item->>'product_id')::uuid,
          default_location_id,
          NEW.project_id,
          NEW.user_id,
          'out',
          -(material_item->>'quantity')::decimal, -- Negative for deduction
          'Automatisch afgeboekt via urenregistratie (werktype: ' || NEW.werktype || ')'
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to process materials after time registration insert
DROP TRIGGER IF EXISTS trigger_process_time_registration_materials ON time_registrations;
CREATE TRIGGER trigger_process_time_registration_materials
  AFTER INSERT ON time_registrations
  FOR EACH ROW
  EXECUTE FUNCTION process_time_registration_materials();