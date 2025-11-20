/*
  # Maak factuur instellingen tabel

  1. Nieuwe Tabel
    - `invoice_settings`
      - `id` (uuid, primary key)
      - `company_name` (text) - Bedrijfsnaam
      - `kvk_number` (text) - KVK nummer
      - `btw_number` (text) - BTW nummer
      - `iban` (text) - IBAN bankrekeningnummer
      - `address_street` (text) - Straat en huisnummer
      - `address_zip` (text) - Postcode
      - `address_city` (text) - Plaats
      - `phone` (text) - Telefoonnummer
      - `email` (text) - E-mailadres
      - `website` (text) - Website
      - `invoice_prefix` (text) - Factuur prefix (bijv. "FACT")
      - `invoice_footer` (text) - Factuur footer tekst
      - `payment_terms_days` (integer) - Betalingstermijn in dagen
      - `logo_url` (text) - URL naar logo
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS
    - Admin en kantoorpersoneel kunnen lezen en schrijven
*/

CREATE TABLE IF NOT EXISTS invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'GouweBouw',
  kvk_number text DEFAULT '',
  btw_number text DEFAULT '',
  iban text DEFAULT '',
  address_street text DEFAULT '',
  address_zip text DEFAULT '',
  address_city text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  invoice_prefix text DEFAULT 'FACT',
  invoice_footer text DEFAULT 'Betaling binnen 30 dagen op rekeningnummer',
  payment_terms_days integer DEFAULT 30,
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin en kantoor kunnen invoice settings lezen"
  ON invoice_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

CREATE POLICY "Admin en kantoor kunnen invoice settings bewerken"
  ON invoice_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Insert default settings
INSERT INTO invoice_settings (id, company_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'GouweBouw')
ON CONFLICT (id) DO NOTHING;