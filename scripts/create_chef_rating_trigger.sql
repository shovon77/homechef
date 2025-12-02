-- Optional: Create a database trigger to automatically update chef ratings
-- when reviews are added, updated, or deleted
-- Run this in your Supabase SQL editor

-- Function to recalculate chef rating
CREATE OR REPLACE FUNCTION recalculate_chef_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the chef's rating and rating_count
  UPDATE public.chefs
  SET 
    rating = COALESCE(
      (
        SELECT AVG(rating::numeric)
        FROM public.chef_reviews
        WHERE chef_id = COALESCE(NEW.chef_id, OLD.chef_id)
          AND rating IS NOT NULL
          AND rating >= 1
          AND rating <= 5
      ),
      NULL
    ),
    rating_count = COALESCE(
      (
        SELECT COUNT(*)
        FROM public.chef_reviews
        WHERE chef_id = COALESCE(NEW.chef_id, OLD.chef_id)
          AND rating IS NOT NULL
          AND rating >= 1
          AND rating <= 5
      ),
      0
    )
  WHERE id = COALESCE(NEW.chef_id, OLD.chef_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS chef_reviews_recalculate_rating_insert ON public.chef_reviews;
CREATE TRIGGER chef_reviews_recalculate_rating_insert
  AFTER INSERT ON public.chef_reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_chef_rating();

DROP TRIGGER IF EXISTS chef_reviews_recalculate_rating_update ON public.chef_reviews;
CREATE TRIGGER chef_reviews_recalculate_rating_update
  AFTER UPDATE ON public.chef_reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_chef_rating();

DROP TRIGGER IF EXISTS chef_reviews_recalculate_rating_delete ON public.chef_reviews;
CREATE TRIGGER chef_reviews_recalculate_rating_delete
  AFTER DELETE ON public.chef_reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_chef_rating();

