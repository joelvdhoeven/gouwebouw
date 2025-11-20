/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all foreign keys to improve query performance
    - These indexes are critical for JOIN operations and foreign key lookups
    
  2. Affected Tables
    - `damage_reports` - index on created_by
    - `inventory_items` - index on project_id
    - `inventory_transactions` - indexes on from_location_id and location_id
    - `notifications` - index on sender_id
    - `notifications_v2` - indexes on recipient_id and sender_id
    - `profiles` - index on user_id
    - `projects` - index on created_by
    - `return_items` - index on created_by
    - `special_tools` - index on project_id
    - `system_settings` - index on updated_by
    - `tickets` - index on assigned_to
*/

-- Add index for damage_reports.created_by
CREATE INDEX IF NOT EXISTS idx_damage_reports_created_by 
ON damage_reports(created_by);

-- Add index for inventory_items.project_id
CREATE INDEX IF NOT EXISTS idx_inventory_items_project_id 
ON inventory_items(project_id);

-- Add indexes for inventory_transactions foreign keys
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_from_location_id 
ON inventory_transactions(from_location_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location_id 
ON inventory_transactions(location_id);

-- Add index for notifications.sender_id
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id 
ON notifications(sender_id);

-- Add indexes for notifications_v2 foreign keys
CREATE INDEX IF NOT EXISTS idx_notifications_v2_recipient_id 
ON notifications_v2(recipient_id);

CREATE INDEX IF NOT EXISTS idx_notifications_v2_sender_id 
ON notifications_v2(sender_id);

-- Add index for profiles.user_id
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON profiles(user_id);

-- Add index for projects.created_by
CREATE INDEX IF NOT EXISTS idx_projects_created_by 
ON projects(created_by);

-- Add index for return_items.created_by
CREATE INDEX IF NOT EXISTS idx_return_items_created_by 
ON return_items(created_by);

-- Add index for special_tools.project_id
CREATE INDEX IF NOT EXISTS idx_special_tools_project_id 
ON special_tools(project_id);

-- Add index for system_settings.updated_by
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by 
ON system_settings(updated_by);

-- Add index for tickets.assigned_to
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to 
ON tickets(assigned_to);