-- Speed up aggregates and joins by dish_id (if not already present)
CREATE INDEX IF NOT EXISTS idx_dish_ratings_dish_id ON public.dish_ratings(dish_id);
