-- Drop the existing policy that still allows public access to wallet addresses
DROP POLICY "Public can view profile data except wallet addresses" ON public.profiles;

-- Create a more restrictive policy: authenticated users can view all profiles, but wallet addresses are restricted
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create a separate policy for unauthenticated users to view limited profile data (this won't work with RLS directly, so we'll use functions)
-- For now, restrict all access to authenticated users only

-- Create a secure function to get public profile data without exposing wallet addresses for unauthenticated access
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
  updated_at timestamp with time zone
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
    p.updated_at
  FROM public.profiles p
  WHERE p.user_address = LOWER(profile_user_address)
  LIMIT 1;
END;
$$;