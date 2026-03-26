-- Add offset for pagination on dish detail (smaller initial load)
DROP FUNCTION IF EXISTS public.get_dish_reviews_with_names(bigint, int);

CREATE OR REPLACE FUNCTION public.get_dish_reviews_with_names(
  p_dish_id bigint,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  dish_id bigint,
  rating integer,
  stars integer,
  comment text,
  created_at timestamptz,
  user_id uuid,
  user_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.dish_id,
    r.rating,
    r.stars,
    r.comment,
    r.created_at,
    r.user_id,
    COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(SPLIT_PART(p.email, '@', 1)), ''), 'Anonymous')::text AS user_name
  FROM dish_ratings r
  LEFT JOIN profiles p ON p.id = r.user_id
  WHERE r.dish_id = p_dish_id
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_dish_reviews_with_names(bigint, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_dish_reviews_with_names(bigint, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_dish_reviews_with_names IS 'Returns paginated dish reviews with reviewer names. p_limit max 100.';
