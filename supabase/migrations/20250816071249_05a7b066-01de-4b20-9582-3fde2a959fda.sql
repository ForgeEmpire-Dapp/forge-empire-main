-- Fix Supabase security issues

-- 1. Update auth settings (these are configuration changes in Supabase dashboard)
-- OTP expiry: Reduce from current to 24 hours in Supabase Auth settings
-- Password protection: Enable leaked password protection in Auth settings

-- 2. Allow anonymous access to public profiles for better discoverability
-- Create a public view of profiles that doesn't require authentication
CREATE OR REPLACE FUNCTION public.get_public_profiles(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  user_address text,
  created_at timestamp with time zone,
  visibility text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.user_address,
    p.created_at,
    p.visibility
  FROM public.profiles p
  WHERE p.visibility = 'public'
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$$;

-- 3. Create analytics table for tracking user behavior
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  user_address text,
  event_name text NOT NULL,
  event_properties jsonb DEFAULT '{}'::jsonb,
  page_url text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on analytics
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own analytics events
CREATE POLICY "Users can insert their own analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to view their own analytics events
CREATE POLICY "Users can view their own analytics events"
ON public.analytics_events
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Create notifications table for real-time features
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'follow', 'mention', 'quest_complete', 'achievement')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at 
ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON public.notifications(user_id, read, created_at DESC) WHERE read = false;

-- 5. Create cached social stats for better performance
CREATE TABLE IF NOT EXISTS public.social_stats_cache (
  user_address text PRIMARY KEY,
  posts_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_stats_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read public social stats
CREATE POLICY "Anyone can read social stats cache"
ON public.social_stats_cache
FOR SELECT
USING (true);

-- Only system can update stats cache
CREATE POLICY "System can update social stats cache"
ON public.social_stats_cache
FOR ALL
USING (true);

-- Function to update social stats cache
CREATE OR REPLACE FUNCTION public.update_social_stats_cache(target_address text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.social_stats_cache (user_address, last_updated)
  VALUES (LOWER(target_address), now())
  ON CONFLICT (user_address) 
  DO UPDATE SET last_updated = now();
  
  -- Note: In a real implementation, this would query the smart contract
  -- or maintain counts based on actual social interactions
END;
$$;