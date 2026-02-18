-- ============================================================
-- Fix critical and high-severity RLS issues
-- Run this in Supabase SQL Editor
-- ============================================================
--
-- IMPACT ON EXISTING CODE:
--
-- 1) DISHES: Safe. We drop "dishes update for all" and add a policy so
--    only the chef who owns a dish can update it. All app dish updates
--    are already in chef context (chef dashboard / chef index), so no
--    code changes needed.
--
-- 2) PROFILES: BREAKING if you run part 2. The app currently assumes
--    anyone can read all profiles. Restricting to "own + admins" will
--    break:
--    - Chef dashboard: chefs reading customer names/emails for orders
--    - Chef dashboard: chefs reading customer names for order messages
--    - Chef dashboard: chefs reading reviewer names on their profile
--    - Homepage: reading chef profile coords (latitude/longitude) for map
--    - Reviews (lib/reviews.ts): reading review author names
--    - Auth/chef signup: lookup profile by email to check if email exists
--    - lib/db.ts: loading profile emails for order list
--    - Admin dashboard: OK (admins get profiles_admin_select_all)
--    - Edge functions: OK (service role bypasses RLS)
--    Recommendation: Either skip part 2, or add more SELECT policies
--    (e.g. allow chefs to read profiles of users who ordered from them)
--    and/or use RPCs with SECURITY DEFINER for those flows.
--
-- ============================================================

-- 1) CRITICAL: Remove policy that allows anyone to UPDATE any dish
DROP POLICY IF EXISTS "dishes update for all" ON public.dishes;

-- Replace with: only the chef who owns the dish can update it (chefs.user_id = auth.uid())
CREATE POLICY "dishes_update_own_chef"
  ON public.dishes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chefs c
      WHERE c.id = dishes.chef_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chefs c
      WHERE c.id = dishes.chef_id AND c.user_id = auth.uid()
    )
  );

-- 2) HIGH (optional): Restrict profile read to own row + admins see all
--    WARNING: See IMPACT above. This will break chef dashboard, homepage
--    chef coords, reviews author names, and auth email lookup unless you
--    add more policies or change app code.
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
