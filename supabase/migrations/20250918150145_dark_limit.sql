-- Fix infinite recursion in RLS policies for profiles table
-- This SQL should be executed in Supabase SQL Editor

-- First, disable RLS temporarily to clean up
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Admins and office staff can view all profiles, others can view their own" ON public.profiles;
DROP POLICY IF EXISTS "Admins and office staff can insert any profile, others can insert their own" ON public.profiles;
DROP POLICY IF EXISTS "Admins and office staff can update any profile, others can update their own" ON public.profiles;
DROP POLICY IF EXISTS "Admins and office staff can delete any profile, others can delete their own" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can select their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies

-- 1. Allow users to read their own profile (no recursion)
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Create a separate policy for admins using a function to avoid recursion
-- First create a function that checks if current user is admin without causing recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_office_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'kantoorpersoneel')
  );
$$;

-- 5. Admin/office staff can read all profiles using the function
CREATE POLICY "Admin and office staff can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_office_staff()
);

-- 6. Admin/office staff can insert any profile
CREATE POLICY "Admin and office staff can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id OR public.is_admin_or_office_staff()
);

-- 7. Admin/office staff can update any profile
CREATE POLICY "Admin and office staff can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_office_staff()
)
WITH CHECK (
  auth.uid() = id OR public.is_admin_or_office_staff()
);

-- 8. Admin/office staff can delete any profile (except their own to prevent lockout)
CREATE POLICY "Admin and office staff can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_office_staff() AND auth.uid() != id
);