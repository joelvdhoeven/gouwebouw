/*
  # Fix time_registrations RLS policies

  1. Security Updates
    - Enable RLS on time_registrations table
    - Drop existing conflicting policies
    - Create new policies that correctly reference user roles from profiles table
    
  2. Policy Structure
    - SELECT: Users can view own registrations, admins/kantoorpersoneel can view all
    - INSERT: Users can insert own registrations
    - UPDATE: Users can update own, admins/kantoorpersoneel can update all
    - DELETE: Users can delete own, admins/kantoorpersoneel can delete all
*/

-- Enable RLS for time_registrations table
ALTER TABLE public.time_registrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to view their own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Admins and office staff can view all time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Admins and office staff can update all time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Allow authenticated users to update their own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Admins and office staff can delete all time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Admin and kantoorpersoneel can manage all time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Users can create own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Users can insert own registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Users can insert own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Users can read own time registrations" ON public.time_registrations;
DROP POLICY IF EXISTS "Users can read their own registrations" ON public.time_registrations;

-- Policy for SELECT: Users can view their own time registrations
CREATE POLICY "Allow authenticated users to view their own time registrations"
ON public.time_registrations FOR SELECT
USING (auth.uid() = user_id);

-- Policy for SELECT: Admins and kantoorpersoneel can view all time registrations
CREATE POLICY "Admins and office staff can view all time registrations"
ON public.time_registrations FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'kantoorpersoneel')
);

-- Policy for INSERT: Authenticated users can insert their own time registrations
CREATE POLICY "Allow authenticated users to insert their own time registrations"
ON public.time_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE: Users can update their own time registrations
CREATE POLICY "Allow authenticated users to update their own time registrations"
ON public.time_registrations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE: Admins and kantoorpersoneel can update all time registrations
CREATE POLICY "Admins and office staff can update all time registrations"
ON public.time_registrations FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'kantoorpersoneel')
);

-- Policy for DELETE: Users can delete their own time registrations
CREATE POLICY "Allow authenticated users to delete their own time registrations"
ON public.time_registrations FOR DELETE
USING (auth.uid() = user_id);

-- Policy for DELETE: Admins and kantoorpersoneel can delete all time registrations
CREATE POLICY "Admins and office staff can delete all time registrations"
ON public.time_registrations FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'kantoorpersoneel')
);