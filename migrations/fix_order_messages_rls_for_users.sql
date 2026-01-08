-- Migration: Fix RLS policies for order_messages to allow users to see messages they receive
-- Run this in your Supabase SQL Editor

-- Drop the existing user policy that only allows reading own sent messages
DROP POLICY IF EXISTS "Users can read their own messages" ON public.order_messages;

-- Create updated policy: Users can read messages for their orders
-- This allows users to see:
-- 1. Messages they sent (sender_user_id = auth.uid() or user_id = auth.uid())
-- 2. Messages they received (recipient_user_id = auth.uid())
-- 3. Messages in their orders (order.user_id = auth.uid())
CREATE POLICY "Users can read their messages"
  ON public.order_messages
  FOR SELECT
  USING (
    -- New schema: user is sender or recipient
    (sender_user_id IS NOT NULL AND sender_user_id = auth.uid()) OR 
    (recipient_user_id IS NOT NULL AND recipient_user_id = auth.uid()) OR
    -- Old schema fallback: user sent the message OR message is for their order
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_messages.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Update insert policy to allow users to insert messages where they are the sender
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.order_messages;

CREATE POLICY "Users can insert their own messages"
  ON public.order_messages
  FOR INSERT
  WITH CHECK (
    -- New schema: user is the sender
    sender_user_id = auth.uid() OR
    -- Old schema fallback: user_id matches auth.uid()
    user_id = auth.uid()
  );
