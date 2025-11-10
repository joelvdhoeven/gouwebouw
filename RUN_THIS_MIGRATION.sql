-- ===================================================================
-- IMPORTANT: RUN THIS SQL IN YOUR SUPABASE SQL EDITOR
-- ===================================================================
-- This adds the demo mode columns to your system_settings table
--
-- Steps:
-- 1. Go to your Supabase project dashboard
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste this entire file
-- 5. Click "Run" or press Ctrl+Enter
-- ===================================================================

-- Add demo mode fields to system_settings table
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS module_invoicing_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_hourly_rates_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_damage_reports_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_inventory_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_notifications_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_email_notifications_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_time_registration_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_special_tools_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS module_financial_dashboard_demo boolean DEFAULT false;

-- Add comments to explain the demo mode functionality
COMMENT ON COLUMN system_settings.module_invoicing_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_hourly_rates_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_damage_reports_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_inventory_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_notifications_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_email_notifications_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_time_registration_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_special_tools_demo IS 'When true, module is only visible to admin and superuser roles';
COMMENT ON COLUMN system_settings.module_financial_dashboard_demo IS 'When true, module is only visible to admin and superuser roles';

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'system_settings'
AND column_name LIKE '%demo%'
ORDER BY column_name;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================
-- If you see 9 rows with the demo columns listed, you're all set!
-- The columns should all be of type 'boolean' with default 'false'
-- ===================================================================
