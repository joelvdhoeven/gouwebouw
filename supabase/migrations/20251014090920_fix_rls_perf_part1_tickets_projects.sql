/*
  # Optimize RLS Policies - Part 1: Tickets and Projects

  1. Performance Optimization
    - Replace `auth.uid()` with `(select auth.uid())`
    - Prevents re-evaluation for each row
    
  2. Tables Updated
    - tickets
    - ticket_comments  
    - projects
*/

-- TICKETS TABLE
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Superuser can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON tickets;
DROP POLICY IF EXISTS "Superuser can update any ticket" ON tickets;
DROP POLICY IF EXISTS "Superuser can delete tickets" ON tickets;

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
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

CREATE POLICY "Admin and kantoorpersoneel can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

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
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

CREATE POLICY "Superuser can delete tickets"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

-- TICKET COMMENTS TABLE
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON ticket_comments;
DROP POLICY IF EXISTS "SuperUser can view all comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can comment on their tickets" ON ticket_comments;
DROP POLICY IF EXISTS "SuperUser can comment on any ticket" ON ticket_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON ticket_comments;

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
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

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
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

CREATE POLICY "Users can update own comments"
  ON ticket_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own comments"
  ON ticket_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- PROJECTS TABLE
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage projects" ON projects;

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Admin and kantoorpersoneel can manage projects"
  ON projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );