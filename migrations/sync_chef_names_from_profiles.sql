-- Migration: Sync chef names from profiles table to chefs table
-- This updates the chefs.name field with the latest name from profiles.name
-- Matches chefs to profiles by user_id (preferred) or email (fallback)

-- Update chefs table with names from profiles table where user_id matches
UPDATE chefs c
SET name = p.name
FROM profiles p
WHERE c.user_id = p.id
  AND p.name IS NOT NULL
  AND p.name != ''
  AND (c.name IS NULL OR c.name != p.name);

-- Fallback: Update chefs table with names from profiles table where email matches
-- (for cases where user_id might not be set in chefs table)
UPDATE chefs c
SET name = p.name
FROM profiles p
WHERE c.email = p.email
  AND c.user_id IS NULL
  AND p.name IS NOT NULL
  AND p.name != ''
  AND (c.name IS NULL OR c.name != p.name);

-- Verify the results (optional - shows which chefs were updated)
SELECT 
  c.id as chef_id,
  c.name as chef_name,
  p.name as profile_name,
  c.user_id,
  c.email
FROM chefs c
LEFT JOIN profiles p ON c.user_id = p.id OR (c.user_id IS NULL AND c.email = p.email)
WHERE p.name IS NOT NULL
ORDER BY c.id;
