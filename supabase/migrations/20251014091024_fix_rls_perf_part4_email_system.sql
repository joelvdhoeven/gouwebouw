/*
  # Optimize RLS Policies - Part 4: Email System

  1. Performance Optimization
    - Replace `auth.uid()` with `(select auth.uid())`
    
  2. Tables Updated
    - email_templates (using 'owner' column)
    - email_schedules (using 'user_id' column)
    - email_logs
*/

-- EMAIL TEMPLATES TABLE
DROP POLICY IF EXISTS "templates_select_owner" ON email_templates;
DROP POLICY IF EXISTS "templates_modify_owner" ON email_templates;

CREATE POLICY "templates_select_owner"
  ON email_templates FOR SELECT
  USING (owner = (select auth.uid()));

CREATE POLICY "templates_modify_owner"
  ON email_templates FOR ALL
  USING (owner = (select auth.uid()));

-- EMAIL SCHEDULES TABLE
DROP POLICY IF EXISTS "schedules_select_owner" ON email_schedules;
DROP POLICY IF EXISTS "schedules_modify_owner" ON email_schedules;

CREATE POLICY "schedules_select_owner"
  ON email_schedules FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "schedules_modify_owner"
  ON email_schedules FOR ALL
  USING (user_id = (select auth.uid()));

-- EMAIL LOGS TABLE
DROP POLICY IF EXISTS "email_logs_select_own" ON email_logs;
DROP POLICY IF EXISTS "email_logs_insert_own" ON email_logs;
DROP POLICY IF EXISTS "email_logs_update_own" ON email_logs;

CREATE POLICY "email_logs_select_own"
  ON email_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "email_logs_insert_own"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "email_logs_update_own"
  ON email_logs FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));