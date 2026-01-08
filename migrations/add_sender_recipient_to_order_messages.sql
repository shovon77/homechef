-- Migration: Add sender and recipient columns to order_messages table
-- This makes it clear who sent the message and who receives it
-- Run this in your Supabase SQL Editor

-- Add sender_user_id column (who sent the message)
ALTER TABLE public.order_messages
ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id);

-- Add recipient_user_id column (who receives the message)
ALTER TABLE public.order_messages
ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id);

-- Add sender_type column for clarity ('customer' or 'chef')
ALTER TABLE public.order_messages
ADD COLUMN IF NOT EXISTS sender_type text CHECK (sender_type IN ('customer', 'chef'));

-- Populate the new columns from existing data
-- For existing messages:
-- - sender_user_id = user_id (the person who sent it)
-- - recipient_user_id = if user_id matches order.user_id, then it's customer->chef, so recipient is chef's user_id
--                      if user_id doesn't match order.user_id, then it's chef->customer, so recipient is order.user_id
-- - sender_type = 'customer' if user_id matches order.user_id, else 'chef'

UPDATE public.order_messages om
SET 
  sender_user_id = om.user_id,
  recipient_user_id = CASE 
    WHEN om.user_id = o.user_id THEN 
      (SELECT c.user_id FROM public.chefs c WHERE c.id = om.chef_id)
    ELSE 
      o.user_id
  END,
  sender_type = CASE 
    WHEN om.user_id = o.user_id THEN 'customer'
    ELSE 'chef'
  END
FROM public.orders o
WHERE om.order_id = o.id
AND (om.sender_user_id IS NULL OR om.recipient_user_id IS NULL OR om.sender_type IS NULL);

-- Update any messages where recipient_user_id is still NULL (chef doesn't have user_id set)
-- In this case, we'll set recipient_user_id to the order's user_id as a fallback
UPDATE public.order_messages om
SET recipient_user_id = o.user_id
FROM public.orders o
WHERE om.order_id = o.id
AND om.recipient_user_id IS NULL;

-- Make sender_user_id NOT NULL after populating
ALTER TABLE public.order_messages
ALTER COLUMN sender_user_id SET NOT NULL;

-- Make sender_type NOT NULL after populating
ALTER TABLE public.order_messages
ALTER COLUMN sender_type SET NOT NULL;

-- Note: recipient_user_id can be NULL temporarily if chef doesn't have user_id set
-- This will be populated when chefs get their user_id updated via update_chefs_user_id.sql

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_user_id ON public.order_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_recipient_user_id ON public.order_messages(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_type ON public.order_messages(sender_type);

-- Add comments
COMMENT ON COLUMN public.order_messages.sender_user_id IS 'The user_id of the person who sent the message';
COMMENT ON COLUMN public.order_messages.recipient_user_id IS 'The user_id of the person who receives the message';
COMMENT ON COLUMN public.order_messages.sender_type IS 'Type of sender: customer or chef';

-- Note: The old user_id and chef_id columns are kept for backward compatibility
-- but new code should use sender_user_id and recipient_user_id
