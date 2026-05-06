-- IANA timezone for pickup wall-clock validation (checkout, reminders, etc.)
ALTER TABLE public.chefs
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Toronto';

COMMENT ON COLUMN public.chefs.timezone IS
  'IANA timezone ID for interpreting pickup hours at the chef location (e.g. America/Toronto, America/Winnipeg).';

UPDATE public.chefs
SET timezone = 'America/Toronto'
WHERE timezone IS NULL OR trim(timezone) = '';
