-- Function to get daily and monthly active user counts based on login timestamps
-- This function accesses auth.users.last_sign_in_at which is not directly queryable from client

CREATE OR REPLACE FUNCTION get_user_login_stats()
RETURNS TABLE (
  daily_active_users bigint,
  monthly_active_users bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_start timestamp with time zone;
  month_ago timestamp with time zone;
  daily_count bigint;
  monthly_count bigint;
BEGIN
  today_start := date_trunc('day', now());
  month_ago := now() - interval '30 days';
  
  -- Count unique users who logged in today
  SELECT COUNT(DISTINCT id) INTO daily_count
  FROM auth.users
  WHERE last_sign_in_at >= today_start;
  
  -- Count unique users who logged in in last 30 days
  SELECT COUNT(DISTINCT id) INTO monthly_count
  FROM auth.users
  WHERE last_sign_in_at >= month_ago;
  
  RETURN QUERY SELECT daily_count, monthly_count;
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION get_user_login_stats() TO authenticated;
