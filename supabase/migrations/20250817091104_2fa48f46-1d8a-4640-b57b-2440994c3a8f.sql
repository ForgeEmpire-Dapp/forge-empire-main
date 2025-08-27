-- FINAL SECURITY FIX: Create secure function instead of insecure view
-- This properly addresses the security vulnerability without triggering warnings

-- Step 1: Drop the problematic view
DROP VIEW IF EXISTS public.verification_status_safe;

-- Step 2: Create secure function to get verification status
CREATE OR REPLACE FUNCTION public.get_verification_status_safe(target_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  wallet_address text,
  verified boolean,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  attempt_count integer,
  is_locked boolean,
  locked_until_safe timestamp with time zone,
  has_active_verification boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Only allow users to see their own data, or service role to see all
  IF (auth.jwt() ->> 'role'::text) = 'service_role' THEN
    -- Service role can see all data or specific user data
    RETURN QUERY
    SELECT 
      wv.id,
      wv.user_id,
      wv.wallet_address,
      wv.verified,
      wv.expires_at,
      wv.created_at,
      wv.attempt_count,
      (wv.locked_until IS NOT NULL AND wv.locked_until > now()) AS is_locked,
      CASE
        WHEN (wv.locked_until IS NOT NULL AND wv.locked_until > now()) 
        THEN wv.locked_until
        ELSE NULL::timestamp with time zone
      END AS locked_until_safe,
      CASE
        WHEN wv.verified = false AND wv.expires_at > now() 
        THEN true
        ELSE false
      END AS has_active_verification
    FROM public.wallet_verifications wv
    WHERE target_user_id IS NULL OR wv.user_id = target_user_id;
  
  ELSIF auth.uid() IS NOT NULL THEN
    -- Authenticated users can only see their own data
    RETURN QUERY
    SELECT 
      wv.id,
      wv.user_id,
      wv.wallet_address,
      wv.verified,
      wv.expires_at,
      wv.created_at,
      wv.attempt_count,
      (wv.locked_until IS NOT NULL AND wv.locked_until > now()) AS is_locked,
      CASE
        WHEN (wv.locked_until IS NOT NULL AND wv.locked_until > now()) 
        THEN wv.locked_until
        ELSE NULL::timestamp with time zone
      END AS locked_until_safe,
      CASE
        WHEN wv.verified = false AND wv.expires_at > now() 
        THEN true
        ELSE false
      END AS has_active_verification
    FROM public.wallet_verifications wv
    WHERE wv.user_id = auth.uid();
  
  ELSE
    -- No access for unauthenticated users
    RETURN;
  END IF;
END;
$$;

-- Step 3: Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_verification_status_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_verification_status_safe TO service_role;

-- Step 4: Add documentation
COMMENT ON FUNCTION public.get_verification_status_safe IS 'Secure function to get verification status. Users can only access their own data, service role has full access. Replaces insecure verification_status_safe view.';