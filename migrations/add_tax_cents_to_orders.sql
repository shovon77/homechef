-- Add tax_cents and subtotal_cents columns to orders table
-- Tax is always 13% HST applied to (subtotal + platform_fee)

-- Add subtotal_cents column (dish prices only, before fees and tax)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_cents integer;

-- Add tax_cents column (13% HST on subtotal only)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_cents integer;

-- Add comment to document the tax rate
COMMENT ON COLUMN public.orders.tax_cents IS '13% HST tax applied to subtotal_cents only';
COMMENT ON COLUMN public.orders.subtotal_cents IS 'Sum of dish prices before platform fee and taxes';

-- Update existing orders: calculate subtotal_cents and tax_cents from total_cents and platform_fee_cents
-- For existing orders: subtotal = total - platform_fee (assuming no tax was charged before)
-- This is a one-time data migration for historical orders
UPDATE public.orders
SET 
  subtotal_cents = COALESCE(total_cents, 0) - COALESCE(platform_fee_cents, 0),
  tax_cents = 0  -- Historical orders didn't have tax applied
WHERE subtotal_cents IS NULL;

-- Create index for tax reporting
CREATE INDEX IF NOT EXISTS idx_orders_tax_cents ON public.orders(tax_cents);
