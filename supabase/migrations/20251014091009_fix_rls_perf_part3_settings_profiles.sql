/*
  # Optimize RLS Policies - Part 3: Settings and Profiles

  1. Performance Optimization
    - Replace `auth.uid()` with `(select auth.uid())`
    
  2. Tables Updated
    - invoice_settings
    - system_settings
    - profiles
    - app_config
    - notifications
*/

-- INVOICE SETTINGS TABLE
DROP POLICY IF EXISTS "Admin en kantoor kunnen invoice settings lezen" ON invoice_settings;
DROP POLICY IF EXISTS "Admin en kantoor kunnen invoice settings bewerken" ON invoice_settings;

CREATE POLICY "Admin en kantoor kunnen invoice settings lezen"
  ON invoice_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin en kantoor kunnen invoice settings bewerken"
  ON invoice_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- SYSTEM SETTINGS TABLE
DROP POLICY IF EXISTS "Alleen admins kunnen system settings bewerken" ON system_settings;

CREATE POLICY "Alleen admins kunnen system settings bewerken"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- PROFILES TABLE
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can delete other profiles" ON profiles;

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (select auth.uid())
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (select auth.uid())
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Authenticated users can delete other profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = (select auth.uid())
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- APP CONFIG TABLE
DROP POLICY IF EXISTS "Allow admins to manage config" ON app_config;

CREATE POLICY "Allow admins to manage config"
  ON app_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Users can read their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notification status" ON notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;

CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_id = (select auth.uid()));

CREATE POLICY "Users can update their notification status"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = (select auth.uid()));

CREATE POLICY "Users can delete their notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (recipient_id = (select auth.uid()));