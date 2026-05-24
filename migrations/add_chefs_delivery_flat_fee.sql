-- Flat delivery fee in CAD dollars (nullable; used when fulfillment includes delivery)
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS delivery_flat_fee numeric(10, 2);

COMMENT ON COLUMN public.chefs.delivery_flat_fee IS 'Flat delivery fee in CAD dollars when fulfillment_mode is delivery_only or pickup_and_delivery';
