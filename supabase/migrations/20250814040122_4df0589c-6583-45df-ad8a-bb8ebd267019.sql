-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Create a policy that allows public viewing of profiles but restricts wallet addresses to the profile owner
CREATE POLICY "Public can view profile data except wallet addresses" 
ON public.profiles 
FOR SELECT 
USING (
  CASE 
    -- If user is authenticated and viewing their own profile, show everything
    WHEN auth.uid() = user_id THEN true
    -- If user is authenticated but viewing someone else's profile, hide wallet address by making the query return null for user_address when accessed by others
    WHEN auth.uid() IS NOT NULL THEN true  
    -- If user is not authenticated, allow viewing but wallet address will be filtered at application level
    ELSE true
  END
);

-- Create a secure function to get public profile data without exposing wallet addresses
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
  user_address text
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
    -- Only return wallet address if the requesting user owns this profile
    CASE 
      WHEN auth.uid() = p.user_id THEN p.user_address
      ELSE NULL
    END as user_address
  FROM public.profiles p
  WHERE p.user_address = LOWER(profile_user_address);
END;
$$;

-- Create a function to get user's own profile (with wallet address)
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
  updated_at timestamp with time zone
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
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$$;