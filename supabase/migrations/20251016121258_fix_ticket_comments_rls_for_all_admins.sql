/*
  # Fix Ticket Comments RLS for All Admin Roles

  ## Issue
  Current RLS policies only allow specific roles to comment on any ticket.
  Need to ensure 'admin', 'superuser', and 'kantoorpersoneel' can all comment on any ticket.

  ## Changes
  - Update INSERT policy to include all admin-level roles
  - Ensure all elevated roles can comment on any ticket

  ## Security
  - Maintains existing security for regular users (medewerker, zzper)
  - Allows all admin-level roles (admin, superuser, kantoorpersoneel) to support any ticket
*/

-- Drop existing INSERT policies for ticket_comments
DROP POLICY IF EXISTS "Users can comment on their tickets" ON ticket_comments;
DROP POLICY IF EXISTS "SuperUser can comment on any ticket" ON ticket_comments;

-- Recreate INSERT policy for regular users (ticket creators and assigned users)
CREATE POLICY "Users can comment on their tickets"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.created_by = (SELECT auth.uid()) OR tickets.assigned_to = (SELECT auth.uid()))
    )
    AND user_id = (SELECT auth.uid())
  );

-- Recreate INSERT policy for admin/superuser/kantoorpersoneel to comment on ANY ticket
CREATE POLICY "Admin users can comment on any ticket"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'superuser', 'kantoorpersoneel')
    )
    AND user_id = (SELECT auth.uid())
  );