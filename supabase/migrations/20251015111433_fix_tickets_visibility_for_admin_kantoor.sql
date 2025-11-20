/*
  # Fix Tickets Visibility for Admin and Kantoorpersoneel

  1. Changes
    - Drop old restrictive SELECT policy for regular users
    - Add new policy: Admin and kantoorpersoneel can view all tickets created by admin/kantoorpersoneel
    - Keep superuser policy: Superuser can view all tickets
    - Keep creator policy: Anyone can view their own tickets (fallback)

  2. New Logic
    - Superuser: sees everything
    - Admin/Kantoorpersoneel: sees all tickets created by admin/kantoorpersoneel
    - Regular users: sees only their own tickets
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;

-- Policy: Admin and kantoorpersoneel can view all tickets created by admin/kantoorpersoneel
CREATE POLICY "Admin and kantoorpersoneel can view office tickets"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    -- User must be admin or kantoorpersoneel
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
    AND
    -- AND the ticket was created by admin or kantoorpersoneel
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = tickets.created_by
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Policy: Users can view their own tickets (fallback for other roles)
CREATE POLICY "Users can view their own tickets"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
  );