ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_at timestamp with time zone;

COMMENT ON COLUMN public.orders.delivery_at IS 'Customer preferred delivery datetime when fulfillment_method is delivery';
