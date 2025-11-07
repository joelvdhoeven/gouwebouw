/*
  # Add Purchase and Sale Prices to Products

  1. Changes
    - Add `purchase_price` column to `inventory_products` table (nullable decimal)
    - Add `sale_price` column to `inventory_products` table (nullable decimal)
    - These fields allow tracking both purchase and sale prices for inventory items

  2. Notes
    - Existing `price` column remains for backward compatibility
    - New columns are nullable to support products without pricing information
*/

DO $$
BEGIN
  -- Add purchase_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_products' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE inventory_products ADD COLUMN purchase_price DECIMAL(10,2);
  END IF;

  -- Add sale_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_products' AND column_name = 'sale_price'
  ) THEN
    ALTER TABLE inventory_products ADD COLUMN sale_price DECIMAL(10,2);
  END IF;
END $$;