-- Hourly cleanup of orders that never completed payment.
--
-- 1) Enable pg_cron (Dashboard → Integrations → Cron Postgres Module), then apply
--    this migration, OR re-run the DO block at the bottom after enabling.
--    Docs: https://supabase.com/docs/guides/cron/install
--
-- 2) Automated job is slightly stricter than scripts/delete_unpaid_requested_orders.sql:
--    - rejected / cancelled + unpaid: delete anytime.
--    - requested + unpaid: only after checkout window (expires_at) or legacy rows
--      with no expires_at older than 24h — avoids deleting an in-progress checkout.

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
          AND (
            (o.expires_at IS NOT NULL AND o.expires_at < now())
            OR (o.expires_at IS NULL AND o.created_at < now() - interval '24 hours')
          )
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
  'Requested rows only after expires_at or 24h without expires_at. Hourly pg_cron when enabled.';

REVOKE ALL ON FUNCTION public.cleanup_unpaid_orders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_unpaid_orders() FROM anon, authenticated;

-- pg_cron runs as postgres; optional Edge/cron RPC could use service_role
GRANT EXECUTE ON FUNCTION public.cleanup_unpaid_orders() TO service_role;

DO $$
DECLARE
  jid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT j.jobid INTO jid
    FROM cron.job j
    WHERE j.jobname = 'cleanup-unpaid-abandoned-orders'
    LIMIT 1;

    IF jid IS NOT NULL THEN
      PERFORM cron.unschedule(jid);
    END IF;

    PERFORM cron.schedule(
      'cleanup-unpaid-abandoned-orders',
      '0 * * * *',
      'SELECT public.cleanup_unpaid_orders()'
    );
  END IF;
END;
$$;
