-- =============================================================================
-- Delete orders that never completed payment
-- =============================================================================
-- Run in Supabase SQL Editor (postgres role bypasses RLS).
--
-- "Unpaid" (same idea as chef dashboard — not successfully charged):
--   NOT (payment_status = 'succeeded')
--   AND NOT (legacy paid: payment_status IS NULL AND stripe_payment_intent_id IS NOT NULL)
--
-- Status scope: lifecycle rows that never moved past unpaid checkout / rejection.
--   Includes requested (abandoned checkout), rejected (e.g. auto-reject), cancelled.
--   Excludes pending, preparing, ready, completed (chef accepted / fulfillment).
--
-- order_items: delete first (no FK cascade). order_messages / order_issues cascade.
-- notifications: optional cleanup (no FK to orders).
--
-- Hourly automation (DB): migrations/add_cleanup_unpaid_orders_hourly.sql defines
-- public.cleanup_unpaid_orders() + pg_cron. That job waits until requested rows are
-- past expires_at (or 24h if expires_at is null) so active checkouts are not removed.
--
-- --- 0) DIAGNOSTIC — run alone to see what you have (no temp table needed) -----
-- SELECT status, payment_status, count(*) AS n
-- FROM public.orders
-- GROUP BY 1, 2
-- ORDER BY n DESC;

-- SELECT id, status, payment_status, stripe_payment_intent_id, checkout_session_id, created_at
-- FROM public.orders
-- WHERE payment_status IS DISTINCT FROM 'succeeded'
--   AND NOT (payment_status IS NULL AND stripe_payment_intent_id IS NOT NULL)
-- ORDER BY created_at DESC
-- LIMIT 50;

-- --- 1) Build id list (safe to re-run in same session) ------------------------
DROP TABLE IF EXISTS _unpaid_order_ids;
CREATE TEMP TABLE _unpaid_order_ids AS
SELECT o.id
FROM public.orders o
WHERE o.status IN ('requested', 'rejected', 'cancelled')
  AND o.payment_status IS DISTINCT FROM 'succeeded'
  AND NOT (
    o.payment_status IS NULL
    AND o.stripe_payment_intent_id IS NOT NULL
  );
-- Optional age gate (uncomment both lines above closing paren of WHERE):
--   AND o.created_at < now() - interval '7 days'

-- --- 2) PREVIEW ---------------------------------------------------------------
SELECT count(*) AS orders_to_delete FROM _unpaid_order_ids;

SELECT o.id, o.status, o.user_id, o.payment_status, o.stripe_payment_intent_id, o.checkout_session_id, o.created_at
FROM public.orders o
WHERE o.id IN (SELECT id FROM _unpaid_order_ids)
ORDER BY o.created_at DESC;

-- --- 3) DELETE (only after preview looks correct) -----------------------------
-- BEGIN;
-- DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM _unpaid_order_ids);
-- DELETE FROM public.notifications
-- WHERE related_type = 'order'
--   AND related_id IN (SELECT id FROM _unpaid_order_ids);
-- DELETE FROM public.orders WHERE id IN (SELECT id FROM _unpaid_order_ids);
-- COMMIT;
