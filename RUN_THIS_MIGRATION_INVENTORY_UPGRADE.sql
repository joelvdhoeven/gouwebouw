-- =====================================================
-- INVENTORY SYSTEM UPGRADE - MATERIAL GROUPS
-- =====================================================
-- This migration adds material groups and new fields to the inventory system
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
-- =====================================================

-- Step 1: Add new columns to inventory_products table
ALTER TABLE inventory_products
ADD COLUMN IF NOT EXISTS gb_article_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS material_group VARCHAR(2),
ADD COLUMN IF NOT EXISTS supplier_article_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500);

-- Step 2: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_products_material_group ON inventory_products(material_group);
CREATE INDEX IF NOT EXISTS idx_inventory_products_gb_article_number ON inventory_products(gb_article_number);
CREATE INDEX IF NOT EXISTS idx_inventory_products_ean ON inventory_products(ean);

-- Step 3: Add column comments for documentation
COMMENT ON COLUMN inventory_products.material_group IS 'Material group code: 01=Diversen, 02=Pur & Kit, 03=Montage, 04=Afwerking, 05=Gevelbekledingen, 06=Hout, 07=Zakgoed, 08=Tapes en bescherming, 09-10=Reserved';
COMMENT ON COLUMN inventory_products.gb_article_number IS 'Internal GB article number (GB-art.nr.)';
COMMENT ON COLUMN inventory_products.supplier_article_number IS 'Supplier article number (Lev.art.nr.)';
COMMENT ON COLUMN inventory_products.price_per_unit IS 'Price per unit in euros (€/eenh)';
COMMENT ON COLUMN inventory_products.photo_path IS 'Path to product photo in Supabase Storage';

-- =====================================================
-- STORAGE BUCKET SETUP
-- =====================================================
-- Note: The following commands create a storage bucket for product images.
-- If you get an error that the bucket already exists, that's OK - skip to the next step.

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for product images
-- Allow authenticated users to upload images
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow public read access to product images
CREATE POLICY IF NOT EXISTS "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to update their uploads
CREATE POLICY IF NOT EXISTS "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete images
CREATE POLICY IF NOT EXISTS "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run this to verify the migration was successful:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'inventory_products'
-- ORDER BY ordinal_position;

-- =====================================================
-- ROLLBACK (in case you need to undo)
-- =====================================================
-- Uncomment and run these lines if you need to rollback:
-- ALTER TABLE inventory_products
-- DROP COLUMN IF EXISTS gb_article_number,
-- DROP COLUMN IF EXISTS material_group,
-- DROP COLUMN IF EXISTS supplier_article_number,
-- DROP COLUMN IF EXISTS price_per_unit,
-- DROP COLUMN IF EXISTS photo_path;
