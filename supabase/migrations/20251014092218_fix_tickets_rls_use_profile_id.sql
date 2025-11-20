/*
  # Fix Tickets RLS to Use Profile ID

  1. Issue
    - Profiles have user_id = null
    - Auth system uses profile.id = auth.uid()
    - RLS policies were checking profiles.user_id which is always null
    
  2. Solution
    - Update all ticket policies to use profile.id = auth.uid()
    - This matches how the login system works
    
  3. Policies Updated
    - All SELECT, INSERT, UPDATE, DELETE policies for tickets
*/

-- Drop all existing ticket policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Superuser can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON tickets;
DROP POLICY IF EXISTS "Superuser can update any ticket" ON tickets;
DROP POLICY IF EXISTS "Superuser can delete tickets" ON tickets;

-- SELECT policies
CREATE POLICY "Users can view their own tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR 
    assigned_to = (select auth.uid())
  );

CREATE POLICY "Superuser can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'kantoorpersoneel'
    )
  );

-- INSERT policy
CREATE POLICY "Admin and kantoorpersoneel can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

-- UPDATE policies
CREATE POLICY "Users can update their own tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR 
    assigned_to = (select auth.uid())
  );

CREATE POLICY "Superuser can update any ticket"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

-- DELETE policy
CREATE POLICY "Superuser can delete tickets"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );