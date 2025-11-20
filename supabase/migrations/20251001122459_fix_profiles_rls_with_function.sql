/*
  # Fix profiles RLS policies with helper function
  
  1. Changes
    - Create helper function to check if user is admin/office staff
    - Drop existing policies
    - Create new policies using the helper function
  
  2. Security
    - Users can read and update their own profile
    - Admins and kantoorpersoneel can manage all profiles
    - No infinite recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read for admins" ON profiles;
DROP POLICY IF EXISTS "Enable insert for admins" ON profiles;
DROP POLICY IF EXISTS "Enable update for admins" ON profiles;
DROP POLICY IF EXISTS "Enable delete for admins" ON profiles;

-- Create helper function (if not exists)
CREATE OR REPLACE FUNCTION is_admin_or_office_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'kantoorpersoneel')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple policies for regular users (own profile only)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin policies (all profiles)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin_or_office_staff());

CREATE POLICY "Admins can insert all profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_office_staff());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin_or_office_staff())
  WITH CHECK (is_admin_or_office_staff());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() != id AND is_admin_or_office_staff());