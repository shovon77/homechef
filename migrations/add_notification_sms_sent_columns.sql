-- ============================================
-- Add sms_sent and sms_sid columns to notifications
-- ============================================
-- Tracks whether SMS was sent for each notification (updated by send-notification-sms Edge Function)

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS sms_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS sms_sid text;

COMMENT ON COLUMN public.notifications.sms_sent IS 'True if SMS was successfully sent via Twilio';
COMMENT ON COLUMN public.notifications.sms_sid IS 'Twilio message SID when SMS was sent';
