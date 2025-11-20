/*
  # Fix All RLS Policies to Use Profile ID

  1. Issue
    - All tables using profiles.user_id = auth.uid()
    - Should use profiles.id = auth.uid()
    
  2. Solution
    - Update policies for all major tables
    
  3. Tables Updated
    - projects
    - inventory_items, inventory_locations, inventory_products, inventory_stock, inventory_transactions
    - special_tools
    - return_items
    - damage_reports
    - invoice_settings
    - system_settings
    - app_config
    - notifications
    - notifications_v2
*/

-- PROJECTS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage projects" ON projects;
CREATE POLICY "Admin and kantoorpersoneel can manage projects"
  ON projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- INVENTORY ITEMS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage inventory" ON inventory_items;
CREATE POLICY "Admin and kantoorpersoneel can manage inventory"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- INVENTORY LOCATIONS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can insert locations" ON inventory_locations;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update locations" ON inventory_locations;
DROP POLICY IF EXISTS "Admin can delete locations" ON inventory_locations;

CREATE POLICY "Admin and kantoorpersoneel can insert locations"
  ON inventory_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update locations"
  ON inventory_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete locations"
  ON inventory_locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- INVENTORY PRODUCTS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can insert products" ON inventory_products;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update products" ON inventory_products;
DROP POLICY IF EXISTS "Admin can delete products" ON inventory_products;

CREATE POLICY "Admin and kantoorpersoneel can insert products"
  ON inventory_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update products"
  ON inventory_products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete products"
  ON inventory_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- INVENTORY STOCK
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage stock" ON inventory_stock;
CREATE POLICY "Admin and kantoorpersoneel can manage stock"
  ON inventory_stock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- INVENTORY TRANSACTIONS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Admin can delete transactions" ON inventory_transactions;

CREATE POLICY "Admin and kantoorpersoneel can update transactions"
  ON inventory_transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin can delete transactions"
  ON inventory_transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- SPECIAL TOOLS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage special tools" ON special_tools;
CREATE POLICY "Admin and kantoorpersoneel can manage special tools"
  ON special_tools FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- RETURN ITEMS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage return items" ON return_items;
CREATE POLICY "Admin and kantoorpersoneel can manage return items"
  ON return_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- DAMAGE REPORTS
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage damage reports" ON damage_reports;
CREATE POLICY "Admin and kantoorpersoneel can manage damage reports"
  ON damage_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- INVOICE SETTINGS
DROP POLICY IF EXISTS "Admin en kantoor kunnen invoice settings lezen" ON invoice_settings;
DROP POLICY IF EXISTS "Admin en kantoor kunnen invoice settings bewerken" ON invoice_settings;

CREATE POLICY "Admin en kantoor kunnen invoice settings lezen"
  ON invoice_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin en kantoor kunnen invoice settings bewerken"
  ON invoice_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- SYSTEM SETTINGS
DROP POLICY IF EXISTS "Alleen admins kunnen system settings bewerken" ON system_settings;
CREATE POLICY "Alleen admins kunnen system settings bewerken"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- APP CONFIG
DROP POLICY IF EXISTS "Allow admins to manage config" ON app_config;
CREATE POLICY "Allow admins to manage config"
  ON app_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- NOTIFICATIONS_V2
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications_v2;
CREATE POLICY "Admins can view all notifications"
  ON notifications_v2 FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

-- USER_ACTIVITY_LOGS
DROP POLICY IF EXISTS "Admins can view all activity logs" ON user_activity_logs;
CREATE POLICY "Admins can view all activity logs"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );