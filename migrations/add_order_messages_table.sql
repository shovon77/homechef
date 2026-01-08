-- Migration: Add order_messages table for storing messages between users and chefs
-- Run this in your Supabase SQL Editor

-- Create order_messages table
CREATE TABLE IF NOT EXISTS public.order_messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  user_id uuid NOT NULL,
  chef_id bigint NOT NULL,
  message text NOT NULL,
  chef_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_messages_pkey PRIMARY KEY (id),
  CONSTRAINT order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT order_messages_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES public.chefs(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_user_id ON public.order_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_chef_id ON public.order_messages(chef_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON public.order_messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own messages
CREATE POLICY "Users can read their own messages"
  ON public.order_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own messages
CREATE POLICY "Users can insert their own messages"
  ON public.order_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Chefs can read messages for their orders
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

-- Add comments
COMMENT ON TABLE public.order_messages IS 'Messages between users and chefs for a specific order';
COMMENT ON COLUMN public.order_messages.order_id IS 'Foreign key to orders table';
COMMENT ON COLUMN public.order_messages.user_id IS 'Foreign key to auth.users - the user sending the message';
COMMENT ON COLUMN public.order_messages.chef_id IS 'Foreign key to chefs table - the chef receiving the message';
COMMENT ON COLUMN public.order_messages.message IS 'The message content';
COMMENT ON COLUMN public.order_messages.chef_name IS 'Cached chef name for display purposes';
