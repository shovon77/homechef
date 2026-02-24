-- ============================================
-- Add Pickup Reminder Notification Types
-- ============================================
-- chef_pickup_reminder: Fires 3h before pickup, notifies chef
-- user_pickup_reminder_2h: Fires 2h before pickup, notifies customer
-- user_pickup_reminder_1h: Fires 1h before pickup, notifies customer

-- Drop the existing CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate the CHECK constraint with the new types
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
  'new_user_signup',
  'review_reply',
  'chef_pickup_reminder',
  'chef_pickup_reminder_1h',
  'user_pickup_reminder_2h',
  'user_pickup_reminder_1h'
));
