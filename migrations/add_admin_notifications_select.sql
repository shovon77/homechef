-- ============================================
-- Allow admins to fetch all notifications for the admin dashboard
-- ============================================
-- This migration adds an RLS policy so admins can SELECT all notifications
-- (to display the notification log in the Notifications tab)

-- Drop existing "Users can view their own notifications" - we'll recreate with OR for admin
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Policy: Users can SELECT their own notifications OR admins can SELECT all
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
