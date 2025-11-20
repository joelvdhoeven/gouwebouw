/*
  # Optimize RLS Policies - Part 2: Inventory System

  1. Performance Optimization
    - Replace `auth.uid()` with `(select auth.uid())`
    
  2. Tables Updated
    - inventory_items
    - inventory_locations
    - inventory_products
    - inventory_stock
    - inventory_transactions
    - special_tools
    - return_items
    - damage_reports
*/

-- INVENTORY ITEMS TABLE
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage inventory" ON inventory_items;

CREATE POLICY "Admin and kantoorpersoneel can manage inventory"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- INVENTORY LOCATIONS TABLE
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can insert locations" ON inventory_locations;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update locations" ON inventory_locations;
DROP POLICY IF EXISTS "Admin can delete locations" ON inventory_locations;

CREATE POLICY "Admin and kantoorpersoneel can insert locations"
  ON inventory_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update locations"
  ON inventory_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete locations"
  ON inventory_locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- INVENTORY PRODUCTS TABLE
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can insert products" ON inventory_products;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update products" ON inventory_products;
DROP POLICY IF EXISTS "Admin can delete products" ON inventory_products;

CREATE POLICY "Admin and kantoorpersoneel can insert products"
  ON inventory_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update products"
  ON inventory_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete products"
  ON inventory_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- INVENTORY STOCK TABLE
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage stock" ON inventory_stock;

CREATE POLICY "Admin and kantoorpersoneel can manage stock"
  ON inventory_stock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- INVENTORY TRANSACTIONS TABLE
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admin can delete transactions" ON inventory_transactions;

CREATE POLICY "Authenticated users can create transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admin and kantoorpersoneel can update transactions"
  ON inventory_transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete transactions"
  ON inventory_transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- SPECIAL TOOLS TABLE
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage special tools" ON special_tools;

CREATE POLICY "Admin and kantoorpersoneel can manage special tools"
  ON special_tools FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- RETURN ITEMS TABLE
DROP POLICY IF EXISTS "Users can create return items" ON return_items;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage return items" ON return_items;

CREATE POLICY "Users can create return items"
  ON return_items FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Admin and kantoorpersoneel can manage return items"
  ON return_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- DAMAGE REPORTS TABLE
DROP POLICY IF EXISTS "Users can create damage reports" ON damage_reports;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage damage reports" ON damage_reports;

CREATE POLICY "Users can create damage reports"
  ON damage_reports FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Admin and kantoorpersoneel can manage damage reports"
  ON damage_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );