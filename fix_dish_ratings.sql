-- Add rating columns to dishes table
ALTER TABLE public.dishes 
ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- Function to calculate and update dish rating
CREATE OR REPLACE FUNCTION public.update_dish_rating()
RETURNS TRIGGER AS $$
DECLARE
    _dish_id bigint;
    _avg_rating numeric;
    _count integer;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        _dish_id := OLD.dish_id;
    ELSE
        _dish_id := NEW.dish_id;
    END IF;

    -- Use 'rating' column if available, fallback to 'stars' if rating is null/0
    -- The schema shows both 'rating' and 'stars' in dish_ratings.
    SELECT 
        COALESCE(AVG(
            CASE 
                WHEN rating IS NOT NULL AND rating > 0 THEN rating 
                WHEN stars IS NOT NULL AND stars > 0 THEN stars
                ELSE NULL 
            END
        ), 0), 
        COUNT(*)
    INTO 
        _avg_rating, 
        _count
    FROM public.dish_ratings
    WHERE dish_id = _dish_id;

    UPDATE public.dishes
    SET 
        rating = ROUND(_avg_rating, 1),
        rating_count = _count
    WHERE id = _dish_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on dish_ratings
DROP TRIGGER IF EXISTS on_dish_rating_change ON public.dish_ratings;
CREATE TRIGGER on_dish_rating_change
AFTER INSERT OR UPDATE OR DELETE ON public.dish_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_dish_rating();

-- Recalculate existing ratings
DO $$
DECLARE
    r RECORD;
    _avg numeric;
    _cnt integer;
BEGIN
    FOR r IN SELECT id FROM public.dishes LOOP
        SELECT 
            COALESCE(AVG(
                CASE 
                    WHEN rating IS NOT NULL AND rating > 0 THEN rating 
                    WHEN stars IS NOT NULL AND stars > 0 THEN stars
                    ELSE NULL 
                END
            ), 0), 
            COUNT(*)
        INTO 
            _avg, 
            _cnt
        FROM public.dish_ratings
        WHERE dish_id = r.id;

        UPDATE public.dishes
        SET 
            rating = ROUND(_avg, 1),
            rating_count = _cnt
        WHERE id = r.id;
    END LOOP;
END;
$$;

