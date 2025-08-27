-- Add visibility column to profiles table for privacy controls
ALTER TABLE public.profiles 
ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private'));

-- Drop the current overly permissive policy
DROP POLICY "Authenticated users can view profiles" ON public.profiles;

-- Create granular policies based on visibility settings
CREATE POLICY "Users can view public profiles" 
ON public.profiles 
FOR SELECT 
USING (
  visibility = 'public' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update the public profile functions to respect visibility
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_address text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  bio text,
  location text,
  website text,
  social_links jsonb,
  avatar_url text,
  banner_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  user_address text,
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
    p.location,
    p.website,
    p.social_links,
    p.avatar_url,
    p.banner_url,
    p.created_at,
    p.updated_at,
    -- Only return wallet address if the requesting user owns this profile or it's public
    CASE 
      WHEN auth.uid() = p.user_id THEN p.user_address
      WHEN p.visibility = 'public' THEN NULL  -- Don't expose wallet even for public profiles
      ELSE NULL
    END as user_address,
    p.visibility
  FROM public.profiles p
  WHERE p.user_address = LOWER(profile_user_address)
    AND (
      p.visibility = 'public' 
      OR auth.uid() = p.user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile_safe(profile_user_address text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  bio text,
  location text,
  website text,
  social_links jsonb,
  avatar_url text,
  banner_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
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
    p.location,
    p.website,
    p.social_links,
    p.avatar_url,
    p.banner_url,
    p.created_at,
    p.updated_at,
    p.visibility
  FROM public.profiles p
  WHERE p.user_address = LOWER(profile_user_address)
    AND p.visibility = 'public';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  bio text,
  location text,
  website text,
  social_links jsonb,
  avatar_url text,
  banner_url text,
  user_address text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  visibility text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to view own profile';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.username,
    p.display_name,
    p.bio,
    p.location,
    p.website,
    p.social_links,
    p.avatar_url,
    p.banner_url,
    p.user_address,
    p.created_at,
    p.updated_at,
    p.visibility
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$$;