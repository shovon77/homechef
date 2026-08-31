-- Aggregate units sold per dish over a recent window.
-- Powers the homepage "Featured this week" ranking (sales signal) for all visitors.
-- SECURITY DEFINER because orders/order_items are RLS-protected; this exposes only
-- per-dish aggregate counts, never order details.
CREATE OR REPLACE FUNCTION public.get_dish_sales_stats(p_days integer DEFAULT 90)
RETURNS TABLE (
  dish_id bigint,
  units_sold bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.dish_id::bigint AS dish_id,
    SUM(GREATEST(COALESCE(oi.quantity, 1), 1))::bigint AS units_sold
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.dish_id IS NOT NULL
    -- Confirmed-and-paid demand only: chef accepted (pending) or fulfilled (ready/completed)
    AND o.status IN ('pending', 'ready', 'completed')
    AND o.created_at >= now() - make_interval(days => GREATEST(COALESCE(p_days, 90), 1))
  GROUP BY oi.dish_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_dish_sales_stats(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_dish_sales_stats(integer) TO authenticated;

COMMENT ON FUNCTION public.get_dish_sales_stats IS 'Units sold per dish in the last N days (default 90). SECURITY DEFINER aggregate for public ranking (homepage featured carousel).';
