/*
  # Add Ticket Comments and Archived Status

  1. New Tables
    - `ticket_comments`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, references tickets)
      - `user_id` (uuid, references profiles)
      - `comment` (text, comment content)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Tickets Table
    - Update status check constraint to include 'archived'

  3. Security
    - Enable RLS on `ticket_comments` table
    - Policy: Users can view comments on tickets they created
    - Policy: SuperUser can view all comments
    - Policy: Users can create comments on tickets they created
    - Policy: SuperUser can create comments on any ticket
    - Policy: Users can update their own comments
    - Policy: Users can delete their own comments
*/

-- Update tickets table status constraint to include archived
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'archived'));

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on ticket_comments table
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comments on tickets they created
CREATE POLICY "Users can view comments on their tickets"
  ON ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND tickets.created_by = auth.uid()
    )
  );

-- Policy: SuperUser can view all comments
CREATE POLICY "SuperUser can view all comments"
  ON ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
    )
  );

-- Policy: Users can create comments on their tickets
CREATE POLICY "Users can comment on their tickets"
  ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND tickets.created_by = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Policy: SuperUser can create comments on any ticket
CREATE POLICY "SuperUser can comment on any ticket"
  ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superuser'
    )
    AND user_id = auth.uid()
  );

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON ticket_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON ticket_comments
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);