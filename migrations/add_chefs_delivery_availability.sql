-- JSON array of delivery windows (same shape as pickup_availability)
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS delivery_availability jsonb;

COMMENT ON COLUMN public.chefs.delivery_availability IS 'JSON array of delivery availability slots: [{"day": "Monday", "timeWindow": "08:00 AM - 09:00 AM"}]';
