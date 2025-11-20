/*
  # Fix profiles update policy voor admins

  1. Wijzigingen
    - Verwijder oude "Users can update own profile" policy
    - Maak nieuwe policy die admins toestaat andere profielen te updaten
    - Maak policy die gebruikers hun eigen profiel kunnen updaten
    
  2. Security
    - Admins kunnen alle profielen updaten
    - Gebruikers kunnen alleen hun eigen profiel updaten
*/

-- Verwijder oude policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Admins kunnen alle profielen updaten
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Gebruikers kunnen hun eigen profiel updaten
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);