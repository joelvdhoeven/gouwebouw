-- =====================================================
-- PROJECT WORK CODES - BEWAKINGSCODES PER PROJECT
-- =====================================================
-- This migration creates a junction table to link work codes to projects
-- Allows administrators to select which work codes are available for each project
-- Also supports project-specific (custom) work codes
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
-- =====================================================

-- Create project_work_codes junction table
CREATE TABLE IF NOT EXISTS project_work_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_code_id UUID REFERENCES work_codes(id) ON DELETE CASCADE,
  -- For project-specific (custom) codes that don't exist in work_codes table
  custom_code VARCHAR(50),
  custom_name VARCHAR(255),
  custom_description TEXT,
  -- Track who added it and when
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure either work_code_id OR custom_code is set, not both or neither
  CONSTRAINT valid_code_reference CHECK (
    (work_code_id IS NOT NULL AND custom_code IS NULL) OR
    (work_code_id IS NULL AND custom_code IS NOT NULL)
  ),
  -- Prevent duplicate work codes per project
  CONSTRAINT unique_work_code_per_project UNIQUE (project_id, work_code_id),
  CONSTRAINT unique_custom_code_per_project UNIQUE (project_id, custom_code)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_work_codes_project ON project_work_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_work_codes_work_code ON project_work_codes(work_code_id);

-- Enable Row Level Security
ALTER TABLE project_work_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Everyone can read project work codes
CREATE POLICY "Allow authenticated read access to project work codes"
  ON project_work_codes FOR SELECT
  TO authenticated
  USING (true);

-- Admin/Kantoorpersoneel can insert
CREATE POLICY "Allow admin/kantoor insert to project work codes"
  ON project_work_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Admin/Kantoorpersoneel can update
CREATE POLICY "Allow admin/kantoor update to project work codes"
  ON project_work_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Admin/Kantoorpersoneel can delete
CREATE POLICY "Allow admin/kantoor delete to project work codes"
  ON project_work_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run these to verify the migration was successful:
-- SELECT * FROM project_work_codes LIMIT 10;
-- \d project_work_codes
