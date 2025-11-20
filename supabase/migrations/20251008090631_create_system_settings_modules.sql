/*
  # Maak systeem instellingen voor module beheer

  1. Nieuwe Tabel
    - `system_settings`
      - `id` (uuid, primary key) - Altijd dezelfde ID voor singleton
      - `module_invoicing` (boolean) - Factuur generatie module
      - `module_hourly_rates` (boolean) - Uurtarieven module
      - `module_damage_reports` (boolean) - Schademeldingen module
      - `module_inventory` (boolean) - Voorraadbeheer module
      - `module_notifications` (boolean) - Meldingen module
      - `module_email_notifications` (boolean) - E-mail notificaties module
      - `module_time_registration` (boolean) - Urenregistratie module
      - `module_special_tools` (boolean) - Speciaal gereedschap module
      - `updated_at` (timestamptz)
      - `updated_by` (uuid) - Foreign key naar profiles
      
  2. Security
    - Enable RLS
    - Iedereen kan lezen (om te controleren of modules actief zijn)
    - Alleen admins kunnen wijzigen
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  module_invoicing boolean DEFAULT true,
  module_hourly_rates boolean DEFAULT true,
  module_damage_reports boolean DEFAULT true,
  module_inventory boolean DEFAULT true,
  module_notifications boolean DEFAULT true,
  module_email_notifications boolean DEFAULT true,
  module_time_registration boolean DEFAULT true,
  module_special_tools boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Iedereen kan system settings lezen"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Alleen admins kunnen system settings bewerken"
  ON system_settings
  FOR UPDATE
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

-- Insert default settings (alle modules aan)
INSERT INTO system_settings (id, updated_by)
VALUES ('00000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;