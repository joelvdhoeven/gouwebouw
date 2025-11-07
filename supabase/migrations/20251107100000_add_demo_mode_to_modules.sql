-- Add demo mode fields to system_settings table
-- Demo mode allows modules to be visible only to admins/superusers for testing

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
