-- ============================================
-- Backfill lat/lon for chefs missing coordinates
-- ============================================
-- Run this query to find chefs that have a location string but no coordinates.
-- Then use the Edge Function or a script to geocode and UPDATE them.
--
-- Step 1: Identify chefs needing geocoding
SELECT id, name, location
FROM public.chefs
WHERE status = 'active'
  AND location IS NOT NULL
  AND TRIM(location) != ''
  AND (latitude IS NULL OR longitude IS NULL);

-- Step 2: After geocoding each chef externally (e.g. via Google Geocode API),
-- update them like so:
--
--   UPDATE public.chefs
--   SET latitude = <lat>, longitude = <lng>
--   WHERE id = <chef_id>;
--
-- Alternatively, invoke the existing `google-geocode-forward` Edge Function
-- for each chef row from a small Node/Deno script, then batch-UPDATE.
--
-- Once all chefs have lat/lon, the browse "nearest" sort no longer needs
-- to geocode at query time, dramatically improving performance.
-- ============================================
