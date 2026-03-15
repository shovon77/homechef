-- ============================================
-- One welcome notification per user (prevent duplicates)
-- ============================================
-- Ensures at most one 'welcome' notification per user_id.
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- 1) Remove duplicate welcome notifications (keep the oldest per user)
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.type = 'welcome'
  AND b.type = 'welcome'
  AND a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- 2) Partial unique index: at most one row per user when type = 'welcome'
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_welcome_per_user
  ON public.notifications (user_id)
  WHERE type = 'welcome';

-- ============================================
-- Notes:
-- ============================================
-- - Inserts of a second welcome for the same user will fail with 23505 (unique_violation).
-- - Client code (createWelcomeNotification) already handles 23505 and returns null.
-- - Other notification types are unchanged (users can have many order_placed, etc.).
