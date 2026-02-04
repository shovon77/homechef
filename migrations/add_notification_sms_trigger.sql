-- ============================================
-- Trigger to send SMS when a notification is inserted
-- ============================================
-- Uses pg_net to call the send-notification-sms Edge Function.
-- Requires: Database > Extensions > enable "pg_net"
-- Requires: Edge Function send-notification-sms deployed with verify_jwt=false
-- (configured in supabase/config.toml)
--
-- Update the URL below if your project ref is different!
-- Get it from: Project Settings > API > Project URL

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create trigger function (uses project URL - update if different)
CREATE OR REPLACE FUNCTION public.trigger_send_notification_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://hjdbfodukvkqkvmwhafc.supabase.co/functions/v1/send-notification-sms';
  v_body jsonb;
BEGIN
  v_body := jsonb_build_object(
    'record',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'title', COALESCE(NEW.title, ''),
      'message', COALESCE(NEW.message, '')
    )
  );

  PERFORM net.http_post(
    url := v_url,
    body := v_body,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'trigger_send_notification_sms failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trigger_send_notification_sms ON public.notifications;

-- Create trigger
CREATE TRIGGER trigger_send_notification_sms
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_notification_sms();
