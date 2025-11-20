/*
  # Email Notification Trigger for Time Registrations

  1. Function
    - Creates a PostgreSQL function that calls the Supabase Edge Function
    - Triggers on INSERT and UPDATE of time_registrations table
    - Only sends notifications for ZZP'ers

  2. Trigger
    - Fires AFTER INSERT OR UPDATE on time_registrations
    - Calls the Edge Function with the new row data
    - Handles errors gracefully without blocking the main operation

  3. Security
    - Uses service role to call Edge Function
    - Includes error handling to prevent trigger failures
*/

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION notify_time_registration_email()
RETURNS TRIGGER AS $$
DECLARE
  request_id uuid;
  payload json;
BEGIN
  -- Only proceed for INSERT operations or when status changes on UPDATE
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Prepare the payload
    payload := json_build_object(
      'record', row_to_json(NEW),
      'operation', TG_OP,
      'table', TG_TABLE_NAME
    );

    -- Call the Edge Function asynchronously
    -- Note: This uses pg_net extension which should be enabled in your Supabase project
    SELECT net.http_post(
      url := (SELECT CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/send-time-registration-email')),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := payload::jsonb
    ) INTO request_id;

    -- Log the request (optional)
    RAISE NOTICE 'Email notification triggered for time registration %, request_id: %', NEW.id, request_id;
    
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the main operation
    RAISE WARNING 'Failed to send email notification for time registration %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS time_registration_email_notification ON time_registrations;

CREATE TRIGGER time_registration_email_notification
  AFTER INSERT OR UPDATE ON time_registrations
  FOR EACH ROW
  EXECUTE FUNCTION notify_time_registration_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_time_registration_email() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_time_registration_email() TO service_role;