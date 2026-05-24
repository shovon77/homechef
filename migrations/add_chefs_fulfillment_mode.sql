-- Chef fulfillment: pickup only, delivery only, or both (default pickup only)
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'pickup_only';

ALTER TABLE public.chefs
DROP CONSTRAINT IF EXISTS chefs_fulfillment_mode_check;

ALTER TABLE public.chefs
ADD CONSTRAINT chefs_fulfillment_mode_check
CHECK (fulfillment_mode IN ('pickup_only', 'delivery_only', 'pickup_and_delivery'));

UPDATE public.chefs
SET fulfillment_mode = 'pickup_only'
WHERE fulfillment_mode IS NULL
   OR fulfillment_mode NOT IN ('pickup_only', 'delivery_only', 'pickup_and_delivery');

COMMENT ON COLUMN public.chefs.fulfillment_mode IS 'How customers receive orders: pickup_only, delivery_only, or pickup_and_delivery';
