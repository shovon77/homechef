-- Add is_active column to dishes table for soft deactivation
-- When is_active = false, the dish is hidden from homepage, search, and explore

ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.dishes.is_active IS 'When false, dish is deactivated and hidden from public listings (homepage, browse, search). Chef can reactivate from their menu.';
