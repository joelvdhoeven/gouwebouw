-- Migration: Remove SKU and make GB-art.nr. required
-- Date: 2025-11-21
-- Description: This migration removes the SKU column and makes gb_article_number the required unique identifier

-- Step 1: First, ensure all existing products have a gb_article_number
-- If any products are missing gb_article_number, copy from SKU as a fallback
UPDATE inventory_products
SET gb_article_number = sku
WHERE gb_article_number IS NULL OR gb_article_number = '';

-- Step 2: Make gb_article_number NOT NULL and add UNIQUE constraint
ALTER TABLE inventory_products
ALTER COLUMN gb_article_number SET NOT NULL;

-- Step 3: Add UNIQUE constraint on gb_article_number
-- First check if constraint already exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'inventory_products_gb_article_number_key'
    ) THEN
        ALTER TABLE inventory_products
        ADD CONSTRAINT inventory_products_gb_article_number_key UNIQUE (gb_article_number);
    END IF;
END $$;

-- Step 4: Drop the SKU column
-- Note: This is irreversible! Make sure you have a backup first.
-- Comment out if you want to keep SKU for historical reference
ALTER TABLE inventory_products
DROP COLUMN IF EXISTS sku;

-- Step 5: Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_products'
AND column_name IN ('gb_article_number', 'sku')
ORDER BY column_name;
