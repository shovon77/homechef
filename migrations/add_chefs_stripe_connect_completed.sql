-- Add stripe_connect_completed to chefs table
-- When true, chef has completed Stripe Connect and can receive orders
-- Dishes from chefs with stripe_connect_completed = false are hidden from homepage and explore

ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS stripe_connect_completed boolean DEFAULT false;

-- Backfill: set stripe_connect_completed = true for chefs whose linked profile has charges_enabled = true
-- Link via chefs.user_id = profiles.id
UPDATE public.chefs c
SET stripe_connect_completed = true
FROM public.profiles p
WHERE c.user_id = p.id
  AND p.charges_enabled = true;

-- Also backfill via email for chefs without user_id
UPDATE public.chefs c
SET stripe_connect_completed = true
FROM public.profiles p
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND p.email = c.email
  AND p.charges_enabled = true;
