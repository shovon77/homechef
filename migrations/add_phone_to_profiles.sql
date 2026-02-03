-- Add phone column to profiles table for user sign-up
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS 'User phone number from sign-up (E.164 format recommended)';
