-- Migration: Add order_issues table for storing customer-reported issues
-- Run this in your Supabase SQL Editor

-- Create order_issues table
CREATE TABLE IF NOT EXISTS public.order_issues (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  user_id uuid NOT NULL,
  chef_id bigint NOT NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('chef_unresponsive', 'pickup_location_unclear', 'chef_running_late', 'food_unavailable', 'other')),
  additional_details text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_issues_pkey PRIMARY KEY (id),
  CONSTRAINT order_issues_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_issues_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT order_issues_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES public.chefs(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_order_issues_order_id ON public.order_issues(order_id);
CREATE INDEX IF NOT EXISTS idx_order_issues_user_id ON public.order_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_order_issues_chef_id ON public.order_issues(chef_id);
CREATE INDEX IF NOT EXISTS idx_order_issues_status ON public.order_issues(status);
CREATE INDEX IF NOT EXISTS idx_order_issues_created_at ON public.order_issues(created_at);

-- Create order_issue_images table for storing issue images
CREATE TABLE IF NOT EXISTS public.order_issue_images (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  issue_id bigint NOT NULL,
  image_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_issue_images_pkey PRIMARY KEY (id),
  CONSTRAINT order_issue_images_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.order_issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_issue_images_issue_id ON public.order_issue_images(issue_id);

-- Enable Row Level Security
ALTER TABLE public.order_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_issue_images ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own reported issues
CREATE POLICY "Users can view their own reported issues"
  ON public.order_issues
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own reported issues
CREATE POLICY "Users can insert their own reported issues"
  ON public.order_issues
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Admins can view all reported issues
CREATE POLICY "Admins can view all reported issues"
  ON public.order_issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Admins can update reported issues
CREATE POLICY "Admins can update reported issues"
  ON public.order_issues
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Chefs can view issues for their orders
CREATE POLICY "Chefs can view issues for their orders"
  ON public.order_issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chefs
      WHERE chefs.id = order_issues.chef_id
      AND chefs.user_id = auth.uid()
    )
  );

-- Create policy: Users can view images for their reported issues
CREATE POLICY "Users can view images for their reported issues"
  ON public.order_issue_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_issues
      WHERE order_issues.id = order_issue_images.issue_id
      AND order_issues.user_id = auth.uid()
    )
  );

-- Create policy: Users can insert images for their reported issues
CREATE POLICY "Users can insert images for their reported issues"
  ON public.order_issue_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_issues
      WHERE order_issues.id = order_issue_images.issue_id
      AND order_issues.user_id = auth.uid()
    )
  );

-- Create policy: Admins can view all issue images
CREATE POLICY "Admins can view all issue images"
  ON public.order_issue_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Add comments
COMMENT ON TABLE public.order_issues IS 'Customer-reported issues for orders';
COMMENT ON COLUMN public.order_issues.issue_type IS 'Type of issue: chef_unresponsive, pickup_location_unclear, chef_running_late, food_unavailable, other';
COMMENT ON COLUMN public.order_issues.status IS 'Status of the issue: pending, reviewing, resolved, dismissed';
COMMENT ON TABLE public.order_issue_images IS 'Images attached to reported issues';
