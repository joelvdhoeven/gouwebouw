/*
  # Add SuperUser Role

  1. Changes
    - Add 'superuser' role to user_role enum type
    
  2. Notes
    - This must be done in a separate transaction before creating tickets table
*/

-- Add superuser role to the role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superuser';