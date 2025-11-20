/*
  # Fix time_registrations INSERT policy

  1. Security Updates
    - Add INSERT policy for time_registrations table
    - Allow authenticated users to create their own time registrations
    - Ensure user_id matches authenticated user ID

  2. Policy Details
    - Policy name: "Users can insert own time registrations"
    - Target: INSERT operations
    - Condition: auth.uid() = user_id
    - Applies to: authenticated role
*/

-- Drop existing INSERT policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own time registrations" ON time_registrations;

-- Create new INSERT policy for time_registrations
CREATE POLICY "Users can insert own time registrations"
  ON time_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled on time_registrations table
ALTER TABLE time_registrations ENABLE ROW LEVEL SECURITY;