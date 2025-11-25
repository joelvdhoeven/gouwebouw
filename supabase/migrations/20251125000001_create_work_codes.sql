-- Create table for general work codes (bewakingscodes/groepcodes)
-- These are NOT project-specific, but available for all projects
CREATE TABLE IF NOT EXISTS work_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_work_codes_active ON work_codes(is_active);
CREATE INDEX idx_work_codes_sort_order ON work_codes(sort_order);

-- Add RLS policies
ALTER TABLE work_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read work codes
CREATE POLICY "Allow authenticated users to read work codes"
  ON work_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admin and kantoorpersoneel to insert work codes
CREATE POLICY "Allow admin to insert work codes"
  ON work_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

-- Allow admin and kantoorpersoneel to update work codes
CREATE POLICY "Allow admin to update work codes"
  ON work_codes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

-- Allow admin and kantoorpersoneel to delete work codes
CREATE POLICY "Allow admin to delete work codes"
  ON work_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

-- Insert default work codes
INSERT INTO work_codes (code, name, description, is_active, sort_order)
VALUES
  ('001', 'Voorbereiding', 'Voorbereidende werkzaamheden', true, 1),
  ('002', 'Uitvoering', 'Uitvoerende werkzaamheden', true, 2),
  ('003', 'Afwerking', 'Afwerkende werkzaamheden', true, 3),
  ('MW01', 'Meerwerk - Onverwacht', 'Meerwerk dat niet in de overeenkomst staat', true, 8000),
  ('999', 'Niet gespecificeerd', 'Gebruik deze code alleen als het werk niet in een andere code past', true, 9999)
ON CONFLICT (code) DO NOTHING;

-- Add comment
COMMENT ON TABLE work_codes IS 'General work codes (bewakingscodes/groepcodes) that employees use to categorize their time registrations. These codes are available for all projects.';
