-- ============================================
-- Add order_rejected notification type
-- ============================================
-- order_rejected: When a chef rejects an order, notify the user that their order was rejected
-- and the refund will be processed immediately

-- Update create_notification_for_user to include order_rejected
CREATE OR REPLACE FUNCTION create_notification_for_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_id bigint DEFAULT NULL,
  p_related_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  IF p_type NOT IN (
    'welcome',
    'order_placed',
    'order_ready',
    'order_issue_updated',
    'order_message',
    'order_rejected',
    'issue_reported',
    'chef_request',
    'chef_application_submitted',
    'chef_application_approved',
    'chef_application_rejected',
    'new_order_request',
    'new_user_signup',
    'review_reply',
    'chef_pickup_reminder',
    'chef_pickup_reminder_1h',
    'user_pickup_reminder_2h',
    'user_pickup_reminder_1h'
  ) THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    related_id,
    related_type,
    read,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_id,
    p_related_type,
    false,
    NOW()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Update notifications table CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'welcome',
  'order_placed',
  'order_ready',
  'order_issue_updated',
  'order_message',
  'order_rejected',
  'issue_reported',
  'chef_request',
  'chef_application_submitted',
  'chef_application_approved',
  'chef_application_rejected',
  'new_order_request',
  'new_user_signup',
  'review_reply',
  'chef_pickup_reminder',
  'chef_pickup_reminder_1h',
  'user_pickup_reminder_2h',
  'user_pickup_reminder_1h'
));
