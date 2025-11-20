/*
  # Fix profiles RLS policies - Correct column names
  
  1. Changes
    - Drop all policies on profiles and notifications
    - Drop helper function
    - Create simple policies that work
  
  2. Security
    - Every authenticated user can read all profiles
    - Users can update their own profile
    - Notifications use recipient_id
*/

-- Drop all policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles CASCADE;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles CASCADE;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles CASCADE;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles CASCADE;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles CASCADE;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles CASCADE;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles CASCADE;

-- Drop all policies on notifications
DROP POLICY IF EXISTS "Admins can read all notifications" ON notifications CASCADE;
DROP POLICY IF EXISTS "Create notifications" ON notifications CASCADE;
DROP POLICY IF EXISTS "Update notifications status" ON notifications CASCADE;
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications CASCADE;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications CASCADE;

-- Drop the function
DROP FUNCTION IF EXISTS is_admin_or_office_staff() CASCADE;

-- Create simple, working policies for profiles
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can delete other profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() != id);

-- Recreate notifications policies with correct column
CREATE POLICY "Users can read their notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their notification status"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete their notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());