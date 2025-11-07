/*
  # Fix App Settings Configuration

  1. Changes
    - Remove invalid app.settings configuration parameters
    - Create a proper configuration table for storing Supabase settings
    - Update the notify_on_time_registration function to use the new configuration table
    - Add proper indexes and security policies

  2. Security
    - Enable RLS on config table
    - Add policy for authenticated users to read config
*/

-- Remove any existing invalid app settings
DO $$
BEGIN
  -- These will fail silently if they don't exist
  EXECUTE 'ALTER DATABASE postgres RESET app.settings.supabase_url';
  EXECUTE 'ALTER DATABASE postgres RESET app.settings.service_role_key';
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if settings don't exist
    NULL;
END $$;

-- Create configuration table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Add policy for reading config (authenticated users only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_config' AND policyname = 'Allow authenticated users to read config'
  ) THEN
    CREATE POLICY "Allow authenticated users to read config"
      ON public.app_config
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add policy for admins to manage config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_config' AND policyname = 'Allow admins to manage config'
  ) THEN
    CREATE POLICY "Allow admins to manage config"
      ON public.app_config
      FOR ALL
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
  END IF;
END $$;

-- Insert default configuration values (replace with your actual values)
INSERT INTO public.app_config (key, value) 
VALUES 
  ('supabase_url', 'https://dhhtzpfvypfrjterarol.supabase.co'),
  ('service_role_key', 'YOUR_SERVICE_ROLE_KEY_HERE')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Update the notify_on_time_registration function to use the config table
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

  -- Get configuration from the config table
  SELECT value INTO project_ref FROM public.app_config WHERE key = 'supabase_url';
  SELECT value INTO service_role_key FROM public.app_config WHERE key = 'service_role_key';

  RAISE NOTICE 'notify_on_time_registration: Project Ref: %', project_ref;
  RAISE NOTICE 'notify_on_time_registration: Service Role Key (first 5 chars): %', SUBSTRING(service_role_key, 1, 5);

  -- fail-safe: require both settings
  IF project_ref IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'notify_on_time_registration: missing project settings, skipping HTTP call';
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