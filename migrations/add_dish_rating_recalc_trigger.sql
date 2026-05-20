-- Keep dishes.rating / rating_count in sync with dish_ratings (server-side, bypasses RLS).
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.update_dish_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_dish_id bigint;
  avg_rating numeric;
  review_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_dish_id := OLD.dish_id;
  ELSE
    target_dish_id := NEW.dish_id;
  END IF;

  SELECT
    ROUND(AVG(
      CASE
        WHEN dr.rating IS NOT NULL AND dr.rating >= 1 AND dr.rating <= 5 THEN dr.rating::numeric
        WHEN dr.stars IS NOT NULL AND dr.stars >= 1 AND dr.stars <= 5 THEN dr.stars::numeric
        ELSE NULL
      END
    ), 1),
    COUNT(*)::integer
  INTO avg_rating, review_count
  FROM public.dish_ratings dr
  WHERE dr.dish_id = target_dish_id
    AND (
      (dr.rating IS NOT NULL AND dr.rating >= 1 AND dr.rating <= 5)
      OR (dr.stars IS NOT NULL AND dr.stars >= 1 AND dr.stars <= 5)
    );

  UPDATE public.dishes
  SET
    rating = COALESCE(avg_rating, 0),
    rating_count = COALESCE(review_count, 0)
  WHERE id = target_dish_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_dish_rating_change ON public.dish_ratings;
CREATE TRIGGER on_dish_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dish_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dish_rating();

-- Backfill all dishes from dish_ratings
UPDATE public.dishes d
SET
  rating = COALESCE(sub.avg_rating, 0),
  rating_count = COALESCE(sub.review_count, 0)
FROM (
  SELECT
    dr.dish_id,
    ROUND(AVG(
      CASE
        WHEN dr.rating IS NOT NULL AND dr.rating >= 1 AND dr.rating <= 5 THEN dr.rating::numeric
        WHEN dr.stars IS NOT NULL AND dr.stars >= 1 AND dr.stars <= 5 THEN dr.stars::numeric
        ELSE NULL
      END
    ), 1) AS avg_rating,
    COUNT(*)::integer AS review_count
  FROM public.dish_ratings dr
  WHERE (dr.rating IS NOT NULL AND dr.rating >= 1 AND dr.rating <= 5)
     OR (dr.stars IS NOT NULL AND dr.stars >= 1 AND dr.stars <= 5)
  GROUP BY dr.dish_id
) sub
WHERE d.id = sub.dish_id;

UPDATE public.dishes d
SET rating = 0, rating_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dish_ratings dr
  WHERE dr.dish_id = d.id
    AND (
      (dr.rating IS NOT NULL AND dr.rating >= 1 AND dr.rating <= 5)
      OR (dr.stars IS NOT NULL AND dr.stars >= 1 AND dr.stars <= 5)
    )
);
