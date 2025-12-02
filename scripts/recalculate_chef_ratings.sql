-- Script to recalculate all chef ratings from chef_reviews
-- Run this in your Supabase SQL editor to fix existing ratings

-- Update all chefs with their calculated ratings from reviews
UPDATE public.chefs c
SET 
  rating = COALESCE(
    (
      SELECT AVG(rating::numeric)
      FROM public.chef_reviews cr
      WHERE cr.chef_id = c.id
        AND cr.rating IS NOT NULL
        AND cr.rating >= 1
        AND cr.rating <= 5
    ),
    NULL
  ),
  rating_count = COALESCE(
    (
      SELECT COUNT(*)
      FROM public.chef_reviews cr
      WHERE cr.chef_id = c.id
        AND cr.rating IS NOT NULL
        AND cr.rating >= 1
        AND cr.rating <= 5
    ),
    0
  )
WHERE EXISTS (
  SELECT 1
  FROM public.chef_reviews cr
  WHERE cr.chef_id = c.id
);

-- Also set rating to NULL and rating_count to 0 for chefs with no reviews
UPDATE public.chefs c
SET 
  rating = NULL,
  rating_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.chef_reviews cr
  WHERE cr.chef_id = c.id
);

