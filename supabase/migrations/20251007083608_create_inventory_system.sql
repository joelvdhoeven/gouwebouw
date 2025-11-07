/*
  # Inventory Management System

  1. New Tables
    - `inventory_locations`
      - `id` (uuid, primary key)
      - `name` (text) - Location name (e.g., "Bus 1 - AA-123-BB", "Magazijn A")
      - `type` (text) - Type: 'bus', 'magazijn', 'other'
      - `license_plate` (text, nullable) - For buses
      - `description` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `inventory_products`
      - `id` (uuid, primary key)
      - `name` (text) - Product name
      - `sku` (text, unique) - Internal SKU
      - `ean` (text, nullable) - EAN barcode
      - `category` (text) - Product category
      - `unit` (text) - Unit of measurement (stuks, meter, kg, etc)
      - `minimum_stock` (integer) - Minimum stock level for alerts
      - `description` (text, nullable)
      - `supplier` (text, nullable)
      - `price` (decimal, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `inventory_stock`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to inventory_products)
      - `location_id` (uuid, foreign key to inventory_locations)
      - `quantity` (decimal) - Current quantity
      - `updated_at` (timestamptz)
      - Unique constraint on (product_id, location_id)
    
    - `inventory_transactions`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to inventory_products)
      - `location_id` (uuid, foreign key to inventory_locations)
      - `project_id` (uuid, nullable, foreign key to projects)
      - `user_id` (uuid, foreign key to profiles)
      - `transaction_type` (text) - 'in', 'out', 'transfer', 'adjustment'
      - `quantity` (decimal) - Positive or negative
      - `from_location_id` (uuid, nullable, foreign key to inventory_locations)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all inventory tables
    - Authenticated users can view inventory
    - Only admin and kantoorpersoneel can add/modify inventory
    - All users can create transactions (booking products)
    - All transactions are logged with user_id
*/

-- Create inventory_locations table
CREATE TABLE IF NOT EXISTS inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('bus', 'magazijn', 'other')),
  license_plate text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_products table
CREATE TABLE IF NOT EXISTS inventory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  ean text,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'stuks',
  minimum_stock integer DEFAULT 0,
  description text,
  supplier text,
  price decimal(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_stock table
CREATE TABLE IF NOT EXISTS inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity decimal(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, location_id)
);

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES inventory_products(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out', 'transfer', 'adjustment')),
  quantity decimal(10,2) NOT NULL,
  from_location_id uuid REFERENCES inventory_locations(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_stock_product ON inventory_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_location ON inventory_stock(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_project ON inventory_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_user ON inventory_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_products_ean ON inventory_products(ean);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON inventory_products(sku);

-- Enable RLS
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_locations
CREATE POLICY "Authenticated users can view locations"
  ON inventory_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and kantoorpersoneel can insert locations"
  ON inventory_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update locations"
  ON inventory_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete locations"
  ON inventory_locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for inventory_products
CREATE POLICY "Authenticated users can view products"
  ON inventory_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and kantoorpersoneel can insert products"
  ON inventory_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update products"
  ON inventory_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete products"
  ON inventory_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for inventory_stock
CREATE POLICY "Authenticated users can view stock"
  ON inventory_stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and kantoorpersoneel can manage stock"
  ON inventory_stock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- RLS Policies for inventory_transactions
CREATE POLICY "Authenticated users can view transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and kantoorpersoneel can update transactions"
  ON inventory_transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete transactions"
  ON inventory_transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update inventory stock after transaction
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock at the location
  INSERT INTO inventory_stock (product_id, location_id, quantity)
  VALUES (NEW.product_id, NEW.location_id, NEW.quantity)
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET 
    quantity = inventory_stock.quantity + NEW.quantity,
    updated_at = now();
  
  -- If it's a transfer, update the from_location as well
  IF NEW.transaction_type = 'transfer' AND NEW.from_location_id IS NOT NULL THEN
    INSERT INTO inventory_stock (product_id, location_id, quantity)
    VALUES (NEW.product_id, NEW.from_location_id, -NEW.quantity)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET 
      quantity = inventory_stock.quantity - NEW.quantity,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update stock
CREATE TRIGGER trigger_update_inventory_stock
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();

-- Function to get products with low stock
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  sku text,
  category text,
  location_id uuid,
  location_name text,
  current_stock decimal,
  minimum_stock integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.category,
    l.id,
    l.name,
    COALESCE(s.quantity, 0),
    p.minimum_stock
  FROM inventory_products p
  CROSS JOIN inventory_locations l
  LEFT JOIN inventory_stock s ON s.product_id = p.id AND s.location_id = l.id
  WHERE COALESCE(s.quantity, 0) < p.minimum_stock
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
