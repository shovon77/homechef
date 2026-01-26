-- ============================================
-- Add 'new_user_signup' Notification Type
-- ============================================
-- This migration adds the 'new_user_signup' notification type to the notifications table
-- Run this SQL in your Supabase SQL Editor

-- Drop the existing CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate the CHECK constraint with the new type
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
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
));

-- ============================================
-- Notes:
-- ============================================
-- This notification type is used to notify admin users when a new user signs up.
-- The notification includes the user's email and name.
