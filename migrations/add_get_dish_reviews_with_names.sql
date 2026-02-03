-- Function to get dish reviews with user names (bypasses RLS for anon users viewing reviews)
-- Allows unauthenticated users to see reviewer names on dish detail page
CREATE OR REPLACE FUNCTION public.get_dish_reviews_with_names(p_dish_id bigint, p_limit int DEFAULT 100)
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
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

-- Grant execute to anon and authenticated (for all users)
GRANT EXECUTE ON FUNCTION public.get_dish_reviews_with_names(bigint, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_dish_reviews_with_names(bigint, int) TO authenticated;

COMMENT ON FUNCTION public.get_dish_reviews_with_names IS 'Returns dish reviews with reviewer names for display. Uses SECURITY DEFINER to allow anon users to see names.';
