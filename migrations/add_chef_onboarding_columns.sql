-- Migration: Add columns for chef onboarding data
-- Run this in your Supabase SQL Editor

-- Add user_id column to chefs table if it doesn't exist
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add cuisine column to chefs table if it doesn't exist
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS cuisine text;

-- Add availability/pickup slots column to chefs table (stored as JSON)
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS pickup_availability jsonb;

-- Add portion column to dishes table if it doesn't exist
ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS portion text;

-- Add ingredients column to dishes table if it doesn't exist (might already exist)
ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS ingredients text;

-- Update profiles table to set is_chef when a chef record is created
-- This will be handled in the application code, but we can add a comment
COMMENT ON COLUMN public.chefs.user_id IS 'Foreign key to auth.users.id - links chef to user account';
COMMENT ON COLUMN public.chefs.cuisine IS 'Cuisine types/specialties (comma-separated or JSON array)';
COMMENT ON COLUMN public.chefs.pickup_availability IS 'JSON array of pickup availability slots: [{"day": "Monday", "timeWindow": "08:00 AM - 09:00 AM"}]';
COMMENT ON COLUMN public.dishes.portion IS 'Portion size per serving/order';
COMMENT ON COLUMN public.dishes.ingredients IS 'List of ingredients and allergens';

