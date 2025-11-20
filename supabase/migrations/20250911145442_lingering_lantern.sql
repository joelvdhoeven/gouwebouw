/*
  # Initial Database Schema for GouweBouw

  1. New Tables
    - `profiles` - User profiles linked to Supabase auth
    - `projects` - Construction projects
    - `time_registrations` - Hour registrations
    - `inventory_items` - Warehouse inventory
    - `special_tools` - Special construction tools
    - `return_items` - Return bookings
    - `damage_reports` - Damage reports for buses and tools

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
*/

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'medewerker', 'kantoorpersoneel', 'zzper');
CREATE TYPE project_status AS ENUM ('actief', 'voltooid', 'gepauzeerd');
CREATE TYPE registration_status AS ENUM ('goedgekeurd', 'in-behandeling', 'afgekeurd');
CREATE TYPE tool_status AS ENUM ('beschikbaar', 'in-gebruik', 'onderhoud');
CREATE TYPE damage_item_type AS ENUM ('bus', 'gereedschap');
CREATE TYPE damage_status AS ENUM ('gemeld', 'in-behandeling', 'opgelost');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  naam text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'medewerker',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  beschrijving text NOT NULL,
  locatie text NOT NULL,
  start_datum date NOT NULL,
  status project_status NOT NULL DEFAULT 'actief',
  estimated_hours integer,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Time registrations table
CREATE TABLE IF NOT EXISTS time_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  project_id uuid REFERENCES projects(id),
  datum date NOT NULL,
  werktype text NOT NULL,
  aantal_uren decimal(4,2) NOT NULL CHECK (aantal_uren > 0),
  werkomschrijving text NOT NULL,
  project_naam text,
  locatie text,
  status registration_status NOT NULL DEFAULT 'in-behandeling',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  artikelnummer text,
  barcode text,
  categorie text NOT NULL,
  locatie text NOT NULL,
  project_id uuid REFERENCES projects(id),
  voorraad integer NOT NULL DEFAULT 0 CHECK (voorraad >= 0),
  minimum_voorraad integer NOT NULL DEFAULT 0 CHECK (minimum_voorraad >= 0),
  eenheid text NOT NULL,
  prijs decimal(10,2),
  leverancier text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Special tools table
CREATE TABLE IF NOT EXISTS special_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  beschrijving text NOT NULL,
  status tool_status NOT NULL DEFAULT 'beschikbaar',
  locatie text NOT NULL,
  laatste_onderhoud date,
  volgende_onderhoud date,
  project_id uuid REFERENCES projects(id),
  foto_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Return items table
CREATE TABLE IF NOT EXISTS return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  artikelnummer text,
  categorie text NOT NULL,
  reden text NOT NULL,
  datum date NOT NULL,
  status registration_status NOT NULL DEFAULT 'in-behandeling',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Damage reports table
CREATE TABLE IF NOT EXISTS damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_item damage_item_type NOT NULL,
  naam text NOT NULL,
  beschrijving text NOT NULL,
  datum date NOT NULL,
  status damage_status NOT NULL DEFAULT 'gemeld',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Everyone can read projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and kantoorpersoneel can manage projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Time registrations policies
CREATE POLICY "Users can read own time registrations"
  ON time_registrations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Users can create own time registrations"
  ON time_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin and kantoorpersoneel can manage all time registrations"
  ON time_registrations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Inventory policies
CREATE POLICY "Everyone can read inventory"
  ON inventory_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and kantoorpersoneel can manage inventory"
  ON inventory_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Special tools policies
CREATE POLICY "Everyone can read special tools"
  ON special_tools
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and kantoorpersoneel can manage special tools"
  ON special_tools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Return items policies
CREATE POLICY "Everyone can read return items"
  ON return_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create return items"
  ON return_items
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admin and kantoorpersoneel can manage return items"
  ON return_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Damage reports policies
CREATE POLICY "Everyone can read damage reports"
  ON damage_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create damage reports"
  ON damage_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admin and kantoorpersoneel can manage damage reports"
  ON damage_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_registrations_user_id ON time_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_time_registrations_project_id ON time_registrations(project_id);
CREATE INDEX IF NOT EXISTS idx_time_registrations_datum ON time_registrations(datum);
CREATE INDEX IF NOT EXISTS idx_inventory_items_categorie ON inventory_items(categorie);
CREATE INDEX IF NOT EXISTS idx_inventory_items_locatie ON inventory_items(locatie);
CREATE INDEX IF NOT EXISTS idx_special_tools_status ON special_tools(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_registrations_updated_at BEFORE UPDATE ON time_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_special_tools_updated_at BEFORE UPDATE ON special_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_return_items_updated_at BEFORE UPDATE ON return_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_damage_reports_updated_at BEFORE UPDATE ON damage_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();