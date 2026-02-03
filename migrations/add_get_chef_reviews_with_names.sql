-- Function to get chef reviews with user names (bypasses RLS for anon users viewing reviews)
-- Allows unauthenticated users to see reviewer names on chef detail page
CREATE OR REPLACE FUNCTION public.get_chef_reviews_with_names(p_chef_id bigint, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE (
  id bigint,
  chef_id bigint,
  rating integer,
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
    r.chef_id,
    r.rating,
    r.comment,
    r.created_at,
    r.user_id,
    COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(SPLIT_PART(p.email, '@', 1)), ''), 'Anonymous')::text AS user_name
  FROM chef_reviews r
  LEFT JOIN profiles p ON p.id = r.user_id
  WHERE r.chef_id = p_chef_id
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100))
  OFFSET GREATEST(0, p_offset);
$$;

-- Grant execute to anon and authenticated (for all users)
GRANT EXECUTE ON FUNCTION public.get_chef_reviews_with_names(bigint, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_chef_reviews_with_names(bigint, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_chef_reviews_with_names IS 'Returns chef reviews with reviewer names for display. Uses SECURITY DEFINER to allow anon users to see names.';
