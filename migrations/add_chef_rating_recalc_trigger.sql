-- Keep chefs.rating / rating_count in sync with chef_reviews (runs server-side, bypasses RLS).
-- Backfills existing rows. Safe to re-run.

CREATE OR REPLACE FUNCTION public.recalculate_chef_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_chef_id bigint;
BEGIN
  target_chef_id := COALESCE(NEW.chef_id, OLD.chef_id);

  UPDATE public.chefs
  SET
    rating = (
      SELECT ROUND(AVG(cr.rating::numeric), 1)
      FROM public.chef_reviews cr
      WHERE cr.chef_id = target_chef_id
        AND cr.rating IS NOT NULL
        AND cr.rating >= 1
        AND cr.rating <= 5
    ),
    rating_count = (
      SELECT COUNT(*)::integer
      FROM public.chef_reviews cr
      WHERE cr.chef_id = target_chef_id
        AND cr.rating IS NOT NULL
        AND cr.rating >= 1
        AND cr.rating <= 5
    )
  WHERE id = target_chef_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS chef_reviews_recalculate_rating_insert ON public.chef_reviews;
CREATE TRIGGER chef_reviews_recalculate_rating_insert
  AFTER INSERT ON public.chef_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_chef_rating();

DROP TRIGGER IF EXISTS chef_reviews_recalculate_rating_update ON public.chef_reviews;
CREATE TRIGGER chef_reviews_recalculate_rating_update
  AFTER UPDATE OF rating, chef_id ON public.chef_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_chef_rating();

DROP TRIGGER IF EXISTS chef_reviews_recalculate_rating_delete ON public.chef_reviews;
CREATE TRIGGER chef_reviews_recalculate_rating_delete
  AFTER DELETE ON public.chef_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_chef_rating();

-- Backfill all chefs from current chef_reviews
UPDATE public.chefs c
SET
  rating = sub.avg_rating,
  rating_count = sub.review_count
FROM (
  SELECT
    cr.chef_id,
    ROUND(AVG(cr.rating::numeric), 1) AS avg_rating,
    COUNT(*)::integer AS review_count
  FROM public.chef_reviews cr
  WHERE cr.rating IS NOT NULL
    AND cr.rating >= 1
    AND cr.rating <= 5
  GROUP BY cr.chef_id
) sub
WHERE c.id = sub.chef_id;

UPDATE public.chefs c
SET rating = NULL, rating_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.chef_reviews cr
  WHERE cr.chef_id = c.id
    AND cr.rating IS NOT NULL
    AND cr.rating >= 1
    AND cr.rating <= 5
);
