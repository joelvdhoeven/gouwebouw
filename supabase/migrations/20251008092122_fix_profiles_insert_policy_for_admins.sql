/*
  # Fix profiles insert policy voor admins

  1. Wijzigingen
    - Verwijder oude "Users can insert own profile" policy
    - Maak nieuwe policy die admins profielen kunnen aanmaken
    - Maak policy die gebruikers hun eigen profiel kunnen aanmaken
    
  2. Security
    - Admins kunnen profielen aanmaken voor nieuwe gebruikers
    - Gebruikers kunnen alleen hun eigen profiel aanmaken
*/

-- Verwijder oude policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Admins kunnen alle profielen aanmaken
CREATE POLICY "Admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Gebruikers kunnen hun eigen profiel aanmaken
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);