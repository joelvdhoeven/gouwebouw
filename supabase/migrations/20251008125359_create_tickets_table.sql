/*
  # Create Tickets System

  1. New Tables
    - `tickets`
      - `id` (uuid, primary key)
      - `title` (text, ticket title)
      - `description` (text, detailed ticket description)
      - `status` (text, ticket status: 'open', 'in_progress', 'resolved', 'closed')
      - `priority` (text, priority level: 'low', 'medium', 'high', 'urgent')
      - `category` (text, ticket category)
      - `created_by` (uuid, references profiles)
      - `assigned_to` (uuid, references profiles, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `resolved_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on `tickets` table
    - Policy: Admin and kantoorpersoneel can create tickets
    - Policy: Only superuser can view all tickets
    - Policy: Ticket creators can view their own tickets
    - Policy: Admin and kantoorpersoneel can update their own tickets
    - Policy: Superuser can update any ticket
    - Policy: Superuser can delete any ticket
*/

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Enable RLS on tickets table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Admin and kantoorpersoneel can create tickets
CREATE POLICY "Admin and kantoorpersoneel can create tickets"
  ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Policy: Superuser can view all tickets
CREATE POLICY "Superuser can view all tickets"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
    )
  );

-- Policy: Ticket creators can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Admin and kantoorpersoneel can update their own tickets
CREATE POLICY "Users can update their own tickets"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'kantoorpersoneel')
    )
  );

-- Policy: Superuser can update any ticket
CREATE POLICY "Superuser can update any ticket"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
    )
  );

-- Policy: Superuser can delete any ticket
CREATE POLICY "Superuser can delete tickets"
  ON tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);