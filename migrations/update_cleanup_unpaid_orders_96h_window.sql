-- The chef-acceptance window (orders.expires_at) was extended from 24h to 96h
-- (see supabase/functions/create-checkout). The hourly cleanup of unpaid
-- abandoned checkouts previously piggybacked on expires_at; without this change
-- abandoned unpaid rows would linger for 96h. Stripe Checkout sessions expire
-- within 24h, so any order still unpaid 24h after creation is abandoned —
-- clean those up based on created_at instead of expires_at.

CREATE OR REPLACE FUNCTION public.cleanup_unpaid_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH target AS (
    SELECT o.id
    FROM public.orders o
    WHERE o.payment_status IS DISTINCT FROM 'succeeded'
      AND NOT (
        o.payment_status IS NULL
        AND o.stripe_payment_intent_id IS NOT NULL
      )
      AND (
        o.status IN ('rejected', 'cancelled')
        OR (
          o.status = 'requested'
          AND o.created_at < now() - interval '24 hours'
        )
      )
  ),
  del_items AS (
    DELETE FROM public.order_items oi
    WHERE oi.order_id IN (SELECT id FROM target)
    RETURNING oi.id
  ),
  del_notif AS (
    DELETE FROM public.notifications n
    WHERE n.related_type = 'order'
      AND n.related_id IN (SELECT id FROM target)
    RETURNING n.id
  ),
  del_orders AS (
    DELETE FROM public.orders o
    WHERE o.id IN (SELECT id FROM target)
    RETURNING o.id
  )
  SELECT count(*)::integer INTO deleted_count FROM del_orders;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.cleanup_unpaid_orders() IS
  'Removes unpaid orders (not succeeded; excludes legacy paid null+stripe_payment_intent_id). '
  'Requested rows only 24h after creation (Stripe sessions expire within 24h). Hourly pg_cron when enabled.';
