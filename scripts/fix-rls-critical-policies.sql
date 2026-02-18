-- ============================================================
-- Fix critical and high-severity RLS issues
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) CRITICAL: Remove policy that allows anyone to UPDATE any dish
DROP POLICY IF EXISTS "dishes update for all" ON public.dishes;

-- 2) HIGH (optional): Restrict profile read to own row + admins see all
--    Drop the "everyone can read all profiles" policy
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;

--    Add: users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

--    Add: admins can read all profiles (for admin dashboard)
CREATE POLICY "profiles_admin_select_all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
