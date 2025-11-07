/*
  # Add Policy for Users to View Their Own Comments

  ## Issue
  Users cannot see their own comments on tickets unless they are the ticket creator/assignee.
  This means if an admin comments on a user's ticket, the user can't see the admin's comment,
  and if a user comments on a ticket they're assigned to, they can't see their own comment.

  ## Changes
  - Add new SELECT policy allowing users to view their own comments
  - This complements existing policies:
    - Users can view comments on tickets they created/assigned to
    - Admin/superuser/kantoorpersoneel can view all comments
    - NEW: Users can view comments they wrote themselves

  ## Security
  - Only allows viewing your own comments
  - Does not expose other users' comments unless already permitted by other policies
*/

-- Add policy for users to view their own comments
CREATE POLICY "Users can view their own comments"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));