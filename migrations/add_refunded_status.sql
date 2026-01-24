-- Migration: Add 'refunded' status to order_issues table
-- Run this in your Supabase SQL Editor

-- Drop the existing CHECK constraint
ALTER TABLE public.order_issues
DROP CONSTRAINT IF EXISTS order_issues_status_check;

-- Add the new CHECK constraint with 'refunded' status
ALTER TABLE public.order_issues
ADD CONSTRAINT order_issues_status_check 
CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed', 'refunded'));

-- Update the comment to reflect the new status
COMMENT ON COLUMN public.order_issues.status IS 'Status of the issue: pending, reviewing, resolved, dismissed, refunded';
