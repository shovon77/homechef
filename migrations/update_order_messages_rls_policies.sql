-- Migration: Update RLS policies for order_messages table
-- Run this in your Supabase SQL Editor to fix the issue where chefs can't see messages

-- Drop the existing chef policy if it exists
DROP POLICY IF EXISTS "Chefs can read messages for their orders" ON public.order_messages;
DROP POLICY IF EXISTS "Chefs can insert messages for their orders" ON public.order_messages;

-- Create updated policy: Chefs can read messages for their orders
-- This allows chefs to read messages where:
-- 1. The message's chef_id matches their chef record AND their chef.user_id = auth.uid()
-- OR
-- 2. The message's order_id belongs to an order where order.chef_id matches their chef record
CREATE POLICY "Chefs can read messages for their orders"
  ON public.order_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chefs
      WHERE chefs.id = order_messages.chef_id
      AND chefs.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.orders
      INNER JOIN public.chefs ON orders.chef_id = chefs.id
      WHERE orders.id = order_messages.order_id
      AND chefs.user_id = auth.uid()
    )
  );

-- Create policy: Chefs can insert messages for their orders
CREATE POLICY "Chefs can insert messages for their orders"
  ON public.order_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      INNER JOIN public.chefs ON orders.chef_id = chefs.id
      WHERE orders.id = order_messages.order_id
      AND chefs.user_id = auth.uid()
    )
  );
