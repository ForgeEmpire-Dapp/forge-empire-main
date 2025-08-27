-- Fix the new security issue that appeared after the last migration
-- Set proper search_path for all functions to prevent mutable search path issues

-- Fix get_public_profiles function
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

-- Fix update_social_stats_cache function
CREATE OR REPLACE FUNCTION public.update_social_stats_cache(target_address text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Also fix the existing functions to have proper search paths
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_profile_with_wallet(wallet_address text, profile_data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  new_user_id UUID;
  profile_id UUID;
BEGIN
  -- Get the current authenticated user ID
  new_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF new_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create profile';
  END IF;
  
  -- Check if profile already exists for this user
  SELECT id INTO profile_id
  FROM public.profiles 
  WHERE user_id = new_user_id;
  
  IF profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profile already exists for this user';
  END IF;
  
  -- Create the profile
  INSERT INTO public.profiles (
    user_id,
    user_address,
    username,
    bio,
    display_name,
    location,
    website,
    social_links
  ) VALUES (
    new_user_id,
    LOWER(wallet_address),
    COALESCE(profile_data->>'username', NULL),
    COALESCE(profile_data->>'bio', NULL),
    COALESCE(profile_data->>'display_name', NULL),
    COALESCE(profile_data->>'location', NULL),
    COALESCE(profile_data->>'website', NULL),
    COALESCE(profile_data->'social_links', '{}'::JSONB)
  ) RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_wallet_to_user(wallet_address text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  current_user_id UUID;
  profile_id UUID;
  existing_profile RECORD;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already has a profile
  SELECT id INTO profile_id
  FROM public.profiles 
  WHERE user_id = current_user_id;
  
  IF profile_id IS NOT NULL THEN
    -- User already has a profile, return it
    RETURN profile_id;
  END IF;
  
  -- Look for existing profile with this wallet address but no user_id
  SELECT * INTO existing_profile
  FROM public.profiles 
  WHERE user_address = LOWER(wallet_address) AND user_id IS NULL
  LIMIT 1;
  
  IF existing_profile.id IS NOT NULL THEN
    -- Link existing profile to authenticated user
    UPDATE public.profiles 
    SET user_id = current_user_id,
        updated_at = NOW()
    WHERE id = existing_profile.id;
    
    RETURN existing_profile.id;
  ELSE
    -- Create new profile for this wallet
    INSERT INTO public.profiles (user_id, user_address)
    VALUES (current_user_id, LOWER(wallet_address))
    RETURNING id INTO profile_id;
    
    RETURN profile_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(profile_user_address text)
RETURNS TABLE(id uuid, username text, display_name text, bio text, location text, website text, social_links jsonb, avatar_url text, banner_url text, created_at timestamp with time zone, updated_at timestamp with time zone, user_address text, visibility text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
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
    -- Only return wallet address if the requesting user owns this profile
    CASE 
      WHEN auth.uid() = p.user_id THEN p.user_address
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

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS TABLE(id uuid, user_id uuid, username text, display_name text, bio text, location text, website text, social_links jsonb, avatar_url text, banner_url text, user_address text, created_at timestamp with time zone, updated_at timestamp with time zone, visibility text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
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

CREATE OR REPLACE FUNCTION public.get_public_profile_safe(profile_user_address text)
RETURNS TABLE(id uuid, username text, display_name text, bio text, location text, website text, social_links jsonb, avatar_url text, banner_url text, created_at timestamp with time zone, updated_at timestamp with time zone, visibility text)
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