-- ============================================
-- Database Function for Creating Notifications
-- ============================================
-- This function allows creating notifications for any user, bypassing RLS
-- Run this SQL in your Supabase SQL Editor

-- Create a function that can create notifications for any user
-- This bypasses RLS using SECURITY DEFINER
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
  -- Validate notification type
  IF p_type NOT IN (
    'welcome',
    'order_placed',
    'order_ready',
    'order_issue_updated',
    'order_message',
    'issue_reported',
    'chef_request',
    'chef_application_submitted',
    'chef_application_approved',
    'chef_application_rejected',
    'new_order_request',
    'new_user_signup'
  ) THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  -- Insert the notification
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_notification_for_user(uuid, text, text, text, bigint, text) TO authenticated;

-- ============================================
-- Notes:
-- ============================================
-- 1. This function uses SECURITY DEFINER to bypass RLS and allow inserting notifications
--    for any user, even when called by a different user.
--
-- 2. The function validates the notification type against the allowed types.
--
-- 3. All authenticated users can call this function, but it will only create notifications
--    for valid user IDs (enforced by foreign key constraint).
--
-- 4. Use this function when you need to create notifications for other users (e.g.,
--    when a customer sends a message to a chef, or when an admin creates a notification
--    for a user).
