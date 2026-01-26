-- ============================================
-- Database Trigger for New User Signup Notifications
-- ============================================
-- This trigger automatically creates notifications for admin users when a new profile is created
-- Run this SQL in your Supabase SQL Editor

-- First, ensure the notification type is added (run add_new_user_signup_notification_type.sql first)

-- Create a function that will be called when a new profile is inserted
CREATE OR REPLACE FUNCTION notify_admins_on_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  admin_user RECORD;
  user_name TEXT;
  user_email TEXT;
BEGIN
  -- Only proceed if this is a new profile (not an update)
  -- The trigger fires on INSERT, so this is always a new profile
  
  -- Get user's name and email
  -- Try to get name from the profile first, then fallback to email prefix
  user_name := COALESCE(
    NULLIF(TRIM(NEW.name), ''),  -- Use name if it's not empty
    CASE 
      WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1)
      ELSE 'User'
    END
  );
  
  user_email := COALESCE(NEW.email, 'No email');

  -- Loop through all admin users and create notifications
  FOR admin_user IN 
    SELECT id FROM public.profiles WHERE is_admin = true AND id != NEW.id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      read,
      created_at
    ) VALUES (
      admin_user.id,
      'new_user_signup',
      'New User Signup',
      'A new user has signed up: ' || user_name || ' (' || user_email || ').',
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_notify_admins_on_new_user_signup ON public.profiles;

-- Create the trigger
CREATE TRIGGER trigger_notify_admins_on_new_user_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_user_signup();

-- ============================================
-- Notes:
-- ============================================
-- 1. This trigger uses SECURITY DEFINER to bypass RLS and allow inserting notifications
--    for admin users even when triggered by a new user signup.
--
-- 2. The trigger only fires on INSERT, not UPDATE, so it won't create duplicate notifications
--    when profiles are updated.
--
-- 3. The function gets the user's name from the profile (if available) or extracts it from email.
