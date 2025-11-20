/*
  # Fix system_settings UPDATE policy
  
  1. Changes
    - Drop existing UPDATE policy
    - Create new UPDATE policy with WITH CHECK clause
    - Ensure admins and superusers can update settings
    - Add proper validation for updated data
  
  2. Security
    - Only admin and superuser roles can update system_settings
    - Validates role on both existing row (USING) and new data (WITH CHECK)
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Alleen admins kunnen system settings bewerken" ON system_settings;

-- Create new policy with WITH CHECK
CREATE POLICY "Alleen admins kunnen system settings bewerken"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superuser')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superuser')
    )
  );