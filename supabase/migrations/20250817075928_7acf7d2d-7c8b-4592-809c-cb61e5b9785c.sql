-- Security fixes migration - Part 1
-- 1. Create security settings table for storing secrets
CREATE TABLE IF NOT EXISTS public.security_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and restrict to admin only
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only postgres/admin can manage security settings"
ON public.security_settings
FOR ALL
USING (CURRENT_USER IN ('postgres', 'supabase_admin'))
WITH CHECK (CURRENT_USER IN ('postgres', 'supabase_admin'));

-- Insert social hash salt
INSERT INTO public.security_settings (key, setting_value)
VALUES ('social_hash_salt', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 2. Drop and recreate get_public_profiles to remove wallet address exposure
DROP FUNCTION IF EXISTS public.get_public_profiles(integer);

CREATE OR REPLACE FUNCTION public.get_public_profiles(limit_count integer DEFAULT 20)
 RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text, created_at timestamp with time zone, visibility text)
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
    p.created_at,
    p.visibility
  FROM public.profiles p
  WHERE p.visibility = 'public'
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$$;

-- 3. Update get_public_social_stats to use HMAC hashing
CREATE OR REPLACE FUNCTION public.get_public_social_stats()
 RETURNS TABLE(user_address_hash text, posts_count integer, likes_count integer, shares_count integer, followers_count integer, following_count integer, last_updated timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Use HMAC with stored salt for stronger hashing
    encode(
      hmac(
        lower(ssc.user_address), 
        (SELECT setting_value FROM public.security_settings WHERE key = 'social_hash_salt' LIMIT 1)::bytea, 
        'sha256'
      ), 
      'hex'
    ) as user_address_hash,
    ssc.posts_count,
    ssc.likes_count,
    ssc.shares_count,
    ssc.followers_count,
    ssc.following_count,
    ssc.last_updated
  FROM public.social_stats_cache ssc;
END;
$$;

-- 4. Fix security_reminder function
CREATE OR REPLACE FUNCTION public.security_reminder()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 'SECURITY REMINDER: Please enable leaked password protection in Supabase Dashboard > Authentication > Settings. This migration creates tables and policies but password protection must be enabled manually.';
$$;