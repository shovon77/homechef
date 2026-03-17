-- Add slug column to chefs for pretty URLs (e.g. /chef/chittagong-kitchen)
-- Run in Supabase SQL Editor. Safe to run multiple times.

ALTER TABLE public.chefs
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: generate slug from name (lowercase, spaces -> hyphens, alphanumeric + hyphen only)
UPDATE public.chefs
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '\s+', '-', 'g'), '[^a-z0-9-]', '', 'gi'))
WHERE slug IS NULL OR slug = '';

-- Empty slug fallback
UPDATE public.chefs SET slug = 'chef-' || id WHERE slug IS NULL OR TRIM(slug) = '';

-- Resolve duplicates by appending id
UPDATE public.chefs c
SET slug = c.slug || '-' || c.id
FROM (
  SELECT slug FROM public.chefs GROUP BY slug HAVING COUNT(*) > 1
) dup
WHERE c.slug = dup.slug;

-- If that created new duplicates (same slug-id), ensure uniqueness
UPDATE public.chefs c
SET slug = c.slug || '-u'
WHERE (SELECT COUNT(*) FROM public.chefs d WHERE d.slug = c.slug) > 1;

-- Constrain
CREATE UNIQUE INDEX IF NOT EXISTS idx_chefs_slug ON public.chefs(slug);
ALTER TABLE public.chefs ALTER COLUMN slug SET NOT NULL;
