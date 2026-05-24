-- How the customer receives the order
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS fulfillment_method text;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_fulfillment_method_check
CHECK (fulfillment_method IN ('pickup', 'delivery'));

UPDATE public.orders
SET fulfillment_method = 'pickup'
WHERE fulfillment_method IS NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_address text;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_phone text;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.fulfillment_method IS 'pickup or delivery';
COMMENT ON COLUMN public.orders.delivery_address IS 'Customer delivery address when fulfillment_method is delivery';
COMMENT ON COLUMN public.orders.delivery_phone IS 'Customer phone for delivery orders';
