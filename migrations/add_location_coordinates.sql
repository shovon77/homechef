-- Add latitude and longitude columns to profiles and chefs tables
-- This allows storing geocoded coordinates for faster distance calculations

-- Add columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add columns to chefs table
ALTER TABLE public.chefs 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add indexes for faster distance queries (using PostGIS would be better, but numeric works for now)
CREATE INDEX IF NOT EXISTS idx_profiles_location_coords ON public.profiles(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chefs_location_coords ON public.chefs(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
