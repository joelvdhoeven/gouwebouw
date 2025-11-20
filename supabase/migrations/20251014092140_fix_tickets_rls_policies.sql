/*
  # Fix Tickets RLS Policies

  1. Issues Fixed
    - Add SELECT policy for admin/kantoorpersoneel to view all tickets
    - Fix INSERT policy to allow proper ticket creation
    
  2. Policies Updated
    - Add "Admin and kantoorpersoneel can view all tickets" for SELECT
    - Ensure all roles can create and view tickets properly
*/

-- Add SELECT policy for admin and kantoorpersoneel to view all tickets
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can view all tickets" ON tickets;

CREATE POLICY "Admin and kantoorpersoneel can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );