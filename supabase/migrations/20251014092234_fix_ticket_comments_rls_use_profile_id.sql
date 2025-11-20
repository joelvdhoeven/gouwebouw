/*
  # Fix Ticket Comments RLS to Use Profile ID

  1. Issue
    - Same as tickets - need to use profile.id instead of profiles.user_id
    
  2. Solution
    - Update all ticket_comments policies to use profile.id = auth.uid()
    
  3. Policies Updated
    - All SELECT, INSERT, UPDATE, DELETE policies for ticket_comments
*/

-- Drop all existing ticket_comments policies
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON ticket_comments;
DROP POLICY IF EXISTS "SuperUser can view all comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can comment on their tickets" ON ticket_comments;
DROP POLICY IF EXISTS "SuperUser can comment on any ticket" ON ticket_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON ticket_comments;

-- SELECT policies
CREATE POLICY "Users can view comments on their tickets"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.created_by = (select auth.uid()) OR tickets.assigned_to = (select auth.uid()))
    )
  );

CREATE POLICY "SuperUser can view all comments"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser', 'kantoorpersoneel')
    )
  );

-- INSERT policies
CREATE POLICY "Users can comment on their tickets"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.created_by = (select auth.uid()) OR tickets.assigned_to = (select auth.uid()))
    )
  );

CREATE POLICY "SuperUser can comment on any ticket"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser', 'kantoorpersoneel')
    )
  );

-- UPDATE policy
CREATE POLICY "Users can update own comments"
  ON ticket_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- DELETE policy
CREATE POLICY "Users can delete own comments"
  ON ticket_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));