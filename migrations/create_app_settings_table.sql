-- Create app_settings table for storing application-wide settings
-- This table stores key-value pairs for settings like banner URL and search placeholders

CREATE TABLE IF NOT EXISTS public.app_settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for homepage banner and search placeholders)
CREATE POLICY "Allow public read access to app_settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Allow admin insert to app_settings"
  ON public.app_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Allow admin update to app_settings"
  ON public.app_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Allow admin delete to app_settings"
  ON public.app_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);
