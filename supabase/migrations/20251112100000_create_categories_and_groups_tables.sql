-- =====================================================
-- PRODUCT CATEGORIES AND MATERIAL GROUPS MANAGEMENT
-- =====================================================
-- This migration creates tables for managing categories and material groups dynamically
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
-- =====================================================

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create material_groups table (replacing hardcoded constants)
CREATE TABLE IF NOT EXISTS material_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories(name);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON product_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_material_groups_code ON material_groups(code);
CREATE INDEX IF NOT EXISTS idx_material_groups_active ON material_groups(is_active);

-- Insert default material groups (01-08)
INSERT INTO material_groups (code, name, description, sort_order) VALUES
  ('01', '01 Diversen', 'Isolatiematerialen, funderingsmaterialen, elektromaterialen, rioleringsmaterialen, rubbers (kozijnen), folies, voegklemmen, spouwankers, etc.', 1),
  ('02', '02 Pur & Kit', 'Pur, kitten, aanverwanten als cleaner, primer, etc.', 2),
  ('03', '03 Montage', 'Schroeven, kozijnschroeven, vulplaatjes, Hannoband, etc.', 3),
  ('04', '04 Afwerking', 'Vensterbanken (kunststof/hardsteen), afwerklijsten (kunststof/MDF), binnendeurdorpels, douchedorpels, etc.', 4),
  ('05', '05 Gevelbekledingen', 'Rabat, gevelsteen, volkern kunststof, etc.', 5),
  ('06', '06 Hout', 'Houten balken, houten beplating, etc.', 6),
  ('07', '07 Zakgoed', 'Mortels (metselen/stuc), etc.', 7),
  ('08', '08 Tapes en bescherming', 'Ducttape, paneltap, primacover, etc.', 8)
ON CONFLICT (code) DO NOTHING;

-- Insert default product categories (matching material groups)
INSERT INTO product_categories (name, description) VALUES
  ('01 Diversen', 'Isolatiematerialen, funderingsmaterialen, elektromaterialen, etc.'),
  ('02 Pur & Kit', 'Pur, kitten, cleaner, primer, etc.'),
  ('03 Montage', 'Schroeven, kozijnschroeven, vulplaatjes, Hannoband, etc.'),
  ('04 Afwerking', 'Vensterbanken, afwerklijsten, dorpels, etc.'),
  ('05 Gevelbekledingen', 'Rabat, gevelsteen, volkern kunststof, etc.'),
  ('06 Hout', 'Houten balken, houten beplating, etc.'),
  ('07 Zakgoed', 'Mortels (metselen/stuc), etc.'),
  ('08 Tapes en bescherming', 'Ducttape, paneltap, primacover, etc.')
ON CONFLICT (name) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_groups_updated_at BEFORE UPDATE ON material_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_groups ENABLE ROW LEVEL SECURITY;

-- Create policies for product_categories
CREATE POLICY "Allow public read access to categories"
  ON product_categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert to categories"
  ON product_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to categories"
  ON product_categories FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete to categories"
  ON product_categories FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for material_groups
CREATE POLICY "Allow public read access to material groups"
  ON material_groups FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert to material groups"
  ON material_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to material groups"
  ON material_groups FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete to material groups"
  ON material_groups FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run these to verify the migration was successful:
-- SELECT * FROM product_categories ORDER BY name;
-- SELECT * FROM material_groups ORDER BY sort_order;
