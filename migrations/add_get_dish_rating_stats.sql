-- Single-query aggregate for dish ratings (avoids downloading all rating rows)
CREATE OR REPLACE FUNCTION public.get_dish_rating_stats(p_dish_id bigint)
RETURNS TABLE (
  avg_rating numeric,
  rating_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      ROUND(AVG(COALESCE(r.rating, r.stars))::numeric, 1),
      0::numeric
    ) AS avg_rating,
    COUNT(*)::bigint AS rating_count
  FROM public.dish_ratings r
  WHERE r.dish_id = p_dish_id
    AND COALESCE(r.rating, r.stars, 0) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_dish_rating_stats(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_dish_rating_stats(bigint) TO authenticated;

COMMENT ON FUNCTION public.get_dish_rating_stats IS 'Returns average rating and count for a dish in one query. SECURITY DEFINER for anonymous public pages.';
