-- Migration script to add cuisine column to chefs table
-- Run this in your Supabase SQL editor

ALTER TABLE public.chefs 
ADD COLUMN IF NOT EXISTS cuisine text;

-- Optional: Update existing chefs with cuisine from their approved applications
-- This will backfill cuisine for chefs who were already approved
UPDATE public.chefs c
SET cuisine = ca.cuisine_specialty
FROM public.chef_applications ca
WHERE ca.name = c.name 
  AND ca.status = 'approved'
  AND c.cuisine IS NULL
  AND ca.cuisine_specialty IS NOT NULL;

