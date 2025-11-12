-- Add material groups and new fields to inventory_products table

-- Add new columns to inventory_products
ALTER TABLE inventory_products
ADD COLUMN IF NOT EXISTS gb_article_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS material_group VARCHAR(2),
ADD COLUMN IF NOT EXISTS supplier_article_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_products_material_group ON inventory_products(material_group);
CREATE INDEX IF NOT EXISTS idx_inventory_products_gb_article_number ON inventory_products(gb_article_number);

-- Add comment to explain material groups
COMMENT ON COLUMN inventory_products.material_group IS 'Material group code: 01=Diversen, 02=Pur & Kit, 03=Montage, 04=Afwerking, 05=Gevelbekledingen, 06=Hout, 07=Zakgoed, 08=Tapes en bescherming, 09-10=Reserved';
COMMENT ON COLUMN inventory_products.gb_article_number IS 'Internal GB article number (GB-art.nr.)';
COMMENT ON COLUMN inventory_products.supplier_article_number IS 'Supplier article number (Lev.art.nr.)';
COMMENT ON COLUMN inventory_products.price_per_unit IS 'Price per unit in euros (€/eenh)';
COMMENT ON COLUMN inventory_products.photo_path IS 'Path to product photo in Supabase Storage';
