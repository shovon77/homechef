-- Migration: Update chefs table to populate user_id from auth.users
-- Run this in your Supabase SQL Editor

-- First, check if user_id column exists, if not add it
ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update chefs.user_id by matching email with auth.users.email
UPDATE public.chefs
SET user_id = auth.users.id
FROM auth.users
WHERE chefs.email = auth.users.email
AND chefs.user_id IS NULL;

-- Verify the update
SELECT 
  c.id as chef_id,
  c.name as chef_name,
  c.email as chef_email,
  c.user_id,
  u.id as auth_user_id,
  u.email as auth_email
FROM public.chefs c
LEFT JOIN auth.users u ON c.user_id = u.id
ORDER BY c.id;

-- Add a comment to document the column
COMMENT ON COLUMN public.chefs.user_id IS 'Foreign key to auth.users.id - links chef to user account. Should match based on email.';
