-- Create table for project-specific work codes (bewakingscodes/groepcodes)
CREATE TABLE IF NOT EXISTS project_work_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, code)
);

-- Create index for faster lookups
CREATE INDEX idx_project_work_codes_project_id ON project_work_codes(project_id);
CREATE INDEX idx_project_work_codes_active ON project_work_codes(is_active);

-- Add RLS policies
ALTER TABLE project_work_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read work codes
CREATE POLICY "Allow authenticated users to read work codes"
  ON project_work_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admin and kantoorpersoneel to insert work codes
CREATE POLICY "Allow admin to insert work codes"
  ON project_work_codes
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
  ON project_work_codes
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
  ON project_work_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel', 'superuser')
    )
  );

-- Insert default work code "999 niet gespecificeerd" for all existing active projects
INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
SELECT
  id,
  '999',
  'Niet gespecificeerd',
  'Gebruik deze code alleen als het werk niet in een andere code past',
  true,
  9999
FROM projects
WHERE status = 'actief'
ON CONFLICT (project_id, code) DO NOTHING;

-- Add some demo work codes for active projects
INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
SELECT
  id,
  '001',
  'Voorbereiding',
  'Voorbereidende werkzaamheden',
  true,
  1
FROM projects
WHERE status = 'actief'
ON CONFLICT (project_id, code) DO NOTHING;

INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
SELECT
  id,
  '002',
  'Funderingswerk',
  'Werkzaamheden aan de fundering',
  true,
  2
FROM projects
WHERE status = 'actief'
ON CONFLICT (project_id, code) DO NOTHING;

INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
SELECT
  id,
  '003',
  'Metselwerk',
  'Metsel- en voegwerk',
  true,
  3
FROM projects
WHERE status = 'actief'
ON CONFLICT (project_id, code) DO NOTHING;

INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
SELECT
  id,
  'MW01',
  'Meerwerk - Onverwacht',
  'Meerwerk dat niet in de overeenkomst staat',
  true,
  8000
FROM projects
WHERE status = 'actief'
ON CONFLICT (project_id, code) DO NOTHING;

-- Create function to automatically add default work code to new projects
CREATE OR REPLACE FUNCTION add_default_work_codes_to_new_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add work codes if project is active
  IF NEW.status = 'actief' THEN
    -- Add "999 niet gespecificeerd" code
    INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
    VALUES (NEW.id, '999', 'Niet gespecificeerd', 'Gebruik deze code alleen als het werk niet in een andere code past', true, 9999)
    ON CONFLICT (project_id, code) DO NOTHING;

    -- Add some default work codes
    INSERT INTO project_work_codes (project_id, code, name, description, is_active, sort_order)
    VALUES
      (NEW.id, '001', 'Voorbereiding', 'Voorbereidende werkzaamheden', true, 1),
      (NEW.id, '002', 'Uitvoering', 'Uitvoerende werkzaamheden', true, 2),
      (NEW.id, '003', 'Afwerking', 'Afwerkende werkzaamheden', true, 3)
    ON CONFLICT (project_id, code) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to add default work codes to new projects
CREATE TRIGGER trigger_add_default_work_codes
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_default_work_codes_to_new_project();

-- Add comment
COMMENT ON TABLE project_work_codes IS 'Project-specific work codes (bewakingscodes/groepcodes) that employees use to categorize their time registrations';
