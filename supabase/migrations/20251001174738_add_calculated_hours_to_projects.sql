/*
  # Add Calculated Hours Field to Projects

  1. Changes
    - Add `calculated_hours` column to projects table
    - This field stores the estimated/calculated hours for completing the project
    - Nullable integer field for flexibility

  2. Purpose
    - Allow project managers to set expected hours for project completion
    - Useful for budgeting and planning purposes
*/

-- Add calculated_hours column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS calculated_hours integer;

-- Add comment for documentation
COMMENT ON COLUMN projects.calculated_hours IS 'Gecalculeerde/geschatte uren voor het voltooien van het project';