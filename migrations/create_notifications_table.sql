-- ============================================
-- Notifications Table Migration
-- ============================================
-- This migration creates the notifications table for the YourHomeChef application
-- Run this SQL in your Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN (
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
    'new_order_request'
  )),
  title text NOT NULL,
  message text NOT NULL,
  related_id bigint, -- Can reference order_id, chef_application_id, issue_id, etc.
  related_type text, -- 'order', 'chef_application', 'issue', etc.
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON public.notifications(type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency - safe to run multiple times)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;

-- Policy: Users can only SELECT (view) their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can UPDATE (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can INSERT notifications for themselves
-- This allows client-side code to create notifications
-- Note: Server-side functions using service role bypass RLS and can insert for any user
CREATE POLICY "Users can insert their own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Notes:
-- ============================================
-- 1. Service role (used in server-side functions/webhooks) bypasses RLS
--    and can insert notifications for any user without policy restrictions.
--
-- 2. Notification types by user role:
--    - Regular users: welcome, order_placed, order_ready, order_issue_updated, order_message
--    - Admin users: all regular + issue_reported, chef_request
--    - Chef users: all regular + chef_application_submitted, chef_application_approved, 
--                  chef_application_rejected, new_order_request
--
-- 3. The related_id and related_type fields allow linking notifications to specific
--    entities (orders, chef applications, issues, etc.) for navigation purposes.
--
-- 4. Notifications are automatically deleted when a user is deleted (ON DELETE CASCADE).
