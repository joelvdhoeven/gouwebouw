/*
  # Fix profiles RLS policies
  
  1. Changes
    - Drop all existing policies on profiles table
    - Recreate simplified policies that actually work
    - Users can read and update their own profile
    - Admins and kantoorpersoneel can manage all profiles
  
  2. Security
    - Ensure all users can read their own profile
    - Ensure all users can update their own profile
    - Admins have full access
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin and office staff can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin and office staff can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin and office staff can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admin and office staff can delete profiles" ON profiles;

-- Create new simplified policies
CREATE POLICY "Enable read for own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Enable insert for own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin policies
CREATE POLICY "Enable read for admins"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Enable insert for admins"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Enable update for admins"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Enable delete for admins"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    auth.uid() != id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );