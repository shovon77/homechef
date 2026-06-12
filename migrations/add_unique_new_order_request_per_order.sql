-- ============================================
-- One new_order_request notification per order (prevent webhook duplicates)
-- ============================================
-- Stripe may fire checkout.session.completed and payment_intent.succeeded close
-- together; a partial unique index makes the second insert fail safely.
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- 1) Remove duplicate new_order_request rows (keep the oldest per order)
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.type = 'new_order_request'
  AND b.type = 'new_order_request'
  AND a.related_type = 'order'
  AND b.related_type = 'order'
  AND a.related_id IS NOT NULL
  AND a.related_id = b.related_id
  AND a.created_at > b.created_at;

-- 2) Partial unique index: at most one chef new-order alert per order
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_new_order_request_per_order
  ON public.notifications (related_id)
  WHERE type = 'new_order_request'
    AND related_type = 'order'
    AND related_id IS NOT NULL;

-- ============================================
-- Notes:
-- ============================================
-- - Does NOT affect order_message (many per order) or pickup reminder types.
-- - Second insert returns 23505 (unique_violation); webhook treats that as success.
-- - SMS trigger only runs on successful INSERT, so duplicate webhooks won't double-text.
