/*
  # Enable RLS and Add Policies for Missing Tables

  1. Security Enhancement
    - Enable RLS on notifications_v2 table
    - Enable RLS on user_activity_logs table
    - Add appropriate security policies
    
  2. Tables Updated
    - notifications_v2: Add policies for users to manage their own notifications
    - user_activity_logs: Add policies for admins to view logs
    
  3. Important Notes
    - Uses optimized (select auth.uid()) pattern
    - Follows principle of least privilege
*/

-- NOTIFICATIONS_V2 TABLE
ALTER TABLE notifications_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications_v2 FOR SELECT
  TO authenticated
  USING (recipient_id = (select auth.uid()));

CREATE POLICY "Admins can view all notifications"
  ON notifications_v2 FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role IN ('admin', 'superuser')
    )
  );

CREATE POLICY "System can create notifications"
  ON notifications_v2 FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON notifications_v2 FOR UPDATE
  TO authenticated
  USING (recipient_id = (select auth.uid()));

CREATE POLICY "Users can delete their own notifications"
  ON notifications_v2 FOR DELETE
  TO authenticated
  USING (recipient_id = (select auth.uid()));

-- USER_ACTIVITY_LOGS TABLE
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all activity logs"
  ON user_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert activity logs"
  ON user_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);