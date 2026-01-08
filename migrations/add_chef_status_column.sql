-- Migration: Add status column to chefs table for deactivation
-- Run this in your Supabase SQL Editor

-- Add status column to chefs table if it doesn't exist
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add is_active column as a backup (boolean)
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update existing chefs to have 'active' status if status is null
UPDATE public.chefs
SET status = 'active'
WHERE status IS NULL;

-- Update existing chefs to have is_active = true if is_active is null
UPDATE public.chefs
SET is_active = true
WHERE is_active IS NULL;

-- Add comments to document the columns
COMMENT ON COLUMN public.chefs.status IS 'Chef account status: active, inactive, pending, etc.';
COMMENT ON COLUMN public.chefs.is_active IS 'Boolean flag for chef account active status (backup to status field)';

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_chefs_status ON public.chefs(status);
CREATE INDEX IF NOT EXISTS idx_chefs_is_active ON public.chefs(is_active);

