/*
  # Fix Projects RLS - Add Superuser Role

  1. Changes
    - Update all project RLS policies to include 'superuser' role
    - Superuser should have full access to all project operations

  2. Security
    - Superuser, admin, and kantoorpersoneel can perform all operations
    - Regular users (medewerker, zzper) can still insert own projects
    - All authenticated users can read projects
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can select projects" ON projects;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can insert projects" ON projects;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can update projects" ON projects;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can delete projects" ON projects;

-- Recreate with superuser included
CREATE POLICY "Admins can select projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );
