/*
  # Fix notify function configuration

  1. Updates
    - Replace the `notify_on_time_registration()` function to use the `app_config` table instead of invalid `app.settings.*` parameters
    - Add proper error handling and debug logging
    - Use the existing `app_config` table structure

  2. Configuration
    - The function will read `supabase_url` and `service_role_key` from the `app_config` table
    - Includes fallback handling if configuration is missing
*/

-- Update the notify function to use app_config table instead of app.settings
CREATE OR REPLACE FUNCTION public.notify_on_time_registration()
RETURNS TRIGGER AS $$
DECLARE
  project_ref TEXT;
  service_role_key TEXT;
  function_url TEXT;
  http_response_status INT;
  http_response_body TEXT;
BEGIN
  RAISE NOTICE 'notify_on_time_registration: Trigger fired for time_registration ID %', NEW.id;

  -- Get configuration from app_config table instead of app.settings
  SELECT value INTO project_ref FROM app_config WHERE key = 'supabase_url';
  SELECT value INTO service_role_key FROM app_config WHERE key = 'service_role_key';

  RAISE NOTICE 'notify_on_time_registration: Project Ref: %', project_ref;
  RAISE NOTICE 'notify_on_time_registration: Service Role Key (first 5 chars): %', SUBSTRING(service_role_key, 1, 5);

  -- fail-safe: require both settings
  IF project_ref IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'notify_on_time_registration: missing project settings in app_config table, skipping HTTP call';
    RETURN NEW;
  END IF;

  function_url := project_ref || '/functions/v1/notify-admin-on-time-registration';
  RAISE NOTICE 'notify_on_time_registration: Function URL: %', function_url;
  RAISE NOTICE 'notify_on_time_registration: NEW record: %', NEW;

  SELECT status, content INTO http_response_status, http_response_body
  FROM net.http_post(
    function_url,
    jsonb_build_object('record', NEW),
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  );

  RAISE NOTICE 'notify_on_time_registration: HTTP POST Status: %', http_response_status;
  RAISE NOTICE 'notify_on_time_registration: HTTP POST Body: %', http_response_body;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert the required configuration values into app_config table
-- Replace 'dhhtzpfvypfrjterarol' with your actual project reference
-- Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key
INSERT INTO app_config (key, value) 
VALUES ('supabase_url', 'https://dhhtzpfvypfrjterarol.supabase.co')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- You need to replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key
-- Get this from your Supabase dashboard: Project Settings -> API -> service_role key
INSERT INTO app_config (key, value) 
VALUES ('service_role_key', 'YOUR_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();