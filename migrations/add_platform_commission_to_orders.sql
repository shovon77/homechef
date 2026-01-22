-- Add platform_commission_cents column to orders table
-- Platform commission is 10% of subtotal_cents

-- Add platform_commission_cents column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_commission_cents integer DEFAULT 0;

-- Add comment to document the commission rate
COMMENT ON COLUMN public.orders.platform_commission_cents IS '10% commission on subtotal_cents that goes to the platform';

-- For existing orders, calculate platform_commission_cents from subtotal_cents
-- This is a one-time data migration for historical orders
UPDATE public.orders
SET platform_commission_cents = COALESCE(ROUND(COALESCE(subtotal_cents, 0) * 0.10), 0)
WHERE platform_commission_cents IS NULL OR platform_commission_cents = 0;

-- Create index for commission reporting
CREATE INDEX IF NOT EXISTS idx_orders_platform_commission_cents ON public.orders(platform_commission_cents);
