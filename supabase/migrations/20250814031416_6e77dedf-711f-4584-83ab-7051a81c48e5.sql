-- Fix security warnings: Set proper search_path for functions

-- Drop and recreate the functions with proper search_path
DROP FUNCTION IF EXISTS public.create_profile_with_wallet(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.link_wallet_to_user(TEXT);

-- Recreate function to handle profile creation with wallet integration (with secure search_path)
CREATE OR REPLACE FUNCTION public.create_profile_with_wallet(
  wallet_address TEXT,
  profile_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

-- Recreate function to link existing profiles to users (with secure search_path)
CREATE OR REPLACE FUNCTION public.link_wallet_to_user(wallet_address TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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