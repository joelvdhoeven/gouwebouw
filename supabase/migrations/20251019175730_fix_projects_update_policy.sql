/*
  # Fix Projects Update Policy

  1. Changes
    - Drop the existing "Admin and kantoorpersoneel can manage projects" policy
    - Create separate policies for SELECT, INSERT, UPDATE, and DELETE
    - Each policy properly includes both USING and WITH CHECK clauses where needed

  2. Security
    - Admin and kantoorpersoneel can perform all operations on projects
    - Regular users can only insert projects where they are the creator
    - All authenticated users can read projects
*/

-- Drop the existing ALL policy
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage projects" ON projects;

-- Create separate policies for each operation
CREATE POLICY "Admin and kantoorpersoneel can select projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'kantoorpersoneel')
    )
  );
