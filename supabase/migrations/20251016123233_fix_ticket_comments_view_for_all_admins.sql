/*
  # Fix Ticket Comments View Access for All Admin Roles

  ## Issue
  The "SuperUser can view all comments" policy only allows 'superuser' role to view all comments.
  Admin and kantoorpersoneel roles cannot see all comments, including comments made by superusers.

  ## Changes
  - Drop existing "SuperUser can view all comments" policy
  - Create new policy allowing admin, superuser, and kantoorpersoneel to view ALL comments
  
  ## Security
  - Maintains security for regular users (medewerker, zzper)
  - Allows all admin-level roles to view all ticket comments for support purposes
*/

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "SuperUser can view all comments" ON ticket_comments;

-- Create new SELECT policy for all admin-level roles
CREATE POLICY "Admin roles can view all comments"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'superuser', 'kantoorpersoneel')
    )
  );
