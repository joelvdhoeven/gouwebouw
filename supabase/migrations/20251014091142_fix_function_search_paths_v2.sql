/*
  # Fix Function Search Paths for Security

  1. Security Enhancement
    - Set search_path to be immutable for all functions
    - Prevents search_path manipulation attacks
    
  2. Functions Updated
    - update_updated_at_column
    - update_inventory_stock
    - get_low_stock_products (drop and recreate)
    - notify_time_registration_email
    - notify_on_time_registration
    - set_updated_at
    - ensure_user_activity_logs_table
*/

-- Fix update_updated_at_column function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_inventory_stock function
DROP FUNCTION IF EXISTS update_inventory_stock() CASCADE;
CREATE FUNCTION update_inventory_stock()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transaction_type = 'afboeking' THEN
    UPDATE inventory_stock
    SET quantity = quantity - NEW.quantity
    WHERE product_id = NEW.product_id 
    AND location_id = NEW.location_id;
  ELSIF NEW.transaction_type = 'retour' THEN
    UPDATE inventory_stock
    SET quantity = quantity + NEW.quantity
    WHERE product_id = NEW.product_id 
    AND location_id = NEW.location_id;
  ELSIF NEW.transaction_type = 'verplaatsing' THEN
    UPDATE inventory_stock
    SET quantity = quantity - NEW.quantity
    WHERE product_id = NEW.product_id 
    AND location_id = NEW.from_location_id;
    
    UPDATE inventory_stock
    SET quantity = quantity + NEW.quantity
    WHERE product_id = NEW.product_id 
    AND location_id = NEW.location_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix get_low_stock_products function
DROP FUNCTION IF EXISTS get_low_stock_products() CASCADE;
CREATE FUNCTION get_low_stock_products()
RETURNS TABLE (
  product_id uuid,
  product_name text,
  current_stock integer,
  minimum_stock integer,
  location_name text
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    COALESCE(s.quantity, 0)::integer,
    p.minimum_stock,
    l.name
  FROM inventory_products p
  LEFT JOIN inventory_stock s ON s.product_id = p.id
  LEFT JOIN inventory_locations l ON l.id = s.location_id
  WHERE COALESCE(s.quantity, 0) < p.minimum_stock;
END;
$$;

-- Fix notify_time_registration_email function
DROP FUNCTION IF EXISTS notify_time_registration_email() CASCADE;
CREATE FUNCTION notify_time_registration_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'time_registration_created',
    json_build_object(
      'user_id', NEW.user_id,
      'project_id', NEW.project_id,
      'datum', NEW.datum,
      'aantal_uren', NEW.aantal_uren
    )::text
  );
  RETURN NEW;
END;
$$;

-- Fix notify_on_time_registration function
DROP FUNCTION IF EXISTS notify_on_time_registration() CASCADE;
CREATE FUNCTION notify_on_time_registration()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  admin_id uuid;
BEGIN
  FOR admin_id IN 
    SELECT user_id FROM profiles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications_v2 (
      recipient_id,
      sender_id,
      type,
      title,
      message,
      related_entity_type,
      related_entity_id,
      status
    ) VALUES (
      admin_id,
      NEW.user_id,
      'time_registration',
      'Nieuwe urenregistratie',
      'Er is een nieuwe urenregistratie toegevoegd.',
      'time_registration',
      NEW.id,
      'unread'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Fix set_updated_at function
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
CREATE FUNCTION set_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Fix ensure_user_activity_logs_table function
DROP FUNCTION IF EXISTS ensure_user_activity_logs_table() CASCADE;
CREATE FUNCTION ensure_user_activity_logs_table()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    details jsonb,
    created_at timestamptz DEFAULT now()
  );
END;
$$;

-- Recreate triggers that were dropped with CASCADE
CREATE TRIGGER update_time_registrations_updated_at
  BEFORE UPDATE ON time_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_special_tools_updated_at
  BEFORE UPDATE ON special_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_return_items_updated_at
  BEFORE UPDATE ON return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_damage_reports_updated_at
  BEFORE UPDATE ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_stock_trigger
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();

CREATE TRIGGER notify_time_registration_trigger
  AFTER INSERT ON time_registrations
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_time_registration();