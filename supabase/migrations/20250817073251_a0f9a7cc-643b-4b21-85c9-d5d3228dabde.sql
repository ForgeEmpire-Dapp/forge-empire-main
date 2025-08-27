-- Fix security issue: Restrict public access to wallet addresses in social_stats_cache
-- This addresses the EXPOSED_WALLET_ADDRESSES security finding

-- Drop the current overly permissive public read policy
DROP POLICY IF EXISTS "Public read access to social stats" ON public.social_stats_cache;

-- Create a secure function to get public social stats without exposing wallet addresses
CREATE OR REPLACE FUNCTION public.get_public_social_stats()
RETURNS TABLE(
  user_address_hash TEXT,
  posts_count INTEGER,
  likes_count INTEGER,
  shares_count INTEGER,
  followers_count INTEGER,
  following_count INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Return a hash of the wallet address instead of the actual address
    encode(digest(ssc.user_address, 'sha256'), 'hex') as user_address_hash,
    ssc.posts_count,
    ssc.likes_count,
    ssc.shares_count,
    ssc.followers_count,
    ssc.following_count,
    ssc.last_updated
  FROM public.social_stats_cache ssc;
END;
$$;

-- Create a new restrictive policy for social_stats_cache
-- Only allow authenticated users to view their own data, and service role for management
CREATE POLICY "Users can view their own social stats" 
ON public.social_stats_cache 
FOR SELECT 
USING (
  -- Users can only see their own stats by matching wallet address with their profile
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND lower(p.user_address) = lower(social_stats_cache.user_address)
  )
);

-- Grant execute permission on the public function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_social_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_social_stats() TO anon;

-- Create a secure function for users to get social stats by profile ID instead of wallet address
CREATE OR REPLACE FUNCTION public.get_social_stats_by_profile(profile_id UUID)
RETURNS TABLE(
  posts_count INTEGER,
  likes_count INTEGER,
  shares_count INTEGER,
  followers_count INTEGER,
  following_count INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_address TEXT;
BEGIN
  -- Get the wallet address for the profile (only for public profiles or own profile)
  SELECT p.user_address INTO target_address
  FROM public.profiles p
  WHERE p.id = profile_id
    AND (p.visibility = 'public' OR p.user_id = auth.uid());
    
  -- If no valid profile found, return empty result
  IF target_address IS NULL THEN
    RETURN;
  END IF;
  
  -- Return social stats for this wallet address
  RETURN QUERY
  SELECT 
    ssc.posts_count,
    ssc.likes_count,
    ssc.shares_count,
    ssc.followers_count,
    ssc.following_count,
    ssc.last_updated
  FROM public.social_stats_cache ssc
  WHERE lower(ssc.user_address) = lower(target_address);
END;
$$;

-- Grant execute permission on the profile-based function
GRANT EXECUTE ON FUNCTION public.get_social_stats_by_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_stats_by_profile(UUID) TO anon;

-- Update the existing update function to use proper search path
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