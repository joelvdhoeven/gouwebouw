/*
  # Add CASCADE Delete to Inventory Products

  ## Changes
  - Update foreign key constraint on inventory_transactions.product_id from ON DELETE RESTRICT to ON DELETE CASCADE
  - Update foreign key constraint on inventory_transactions.location_id from ON DELETE RESTRICT to ON DELETE CASCADE
  
  ## Reason
  When a product is deleted, all related transactions should also be deleted automatically.
  This allows administrators to clean up products without orphaned transaction records.
  
  ## Security
  - No changes to RLS policies
  - Maintains existing security model
*/

-- Drop existing foreign key constraints
ALTER TABLE inventory_transactions 
  DROP CONSTRAINT IF EXISTS inventory_transactions_product_id_fkey;

ALTER TABLE inventory_transactions 
  DROP CONSTRAINT IF EXISTS inventory_transactions_location_id_fkey;

-- Add new foreign key constraints with CASCADE delete
ALTER TABLE inventory_transactions 
  ADD CONSTRAINT inventory_transactions_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES inventory_products(id) 
  ON DELETE CASCADE;

ALTER TABLE inventory_transactions 
  ADD CONSTRAINT inventory_transactions_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES inventory_locations(id) 
  ON DELETE CASCADE;