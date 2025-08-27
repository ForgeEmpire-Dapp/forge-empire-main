-- CRITICAL SECURITY FIX: Secure verification_status_safe view
-- Addresses: User Verification Data Could Be Exposed to Unauthorized Users

-- Step 1: Create secure function to check user ownership
CREATE OR REPLACE FUNCTION public.user_owns_verification(verification_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT verification_user_id = auth.uid();
$$;

-- Step 2: Drop and recreate the view with proper security
DROP VIEW IF EXISTS public.verification_status_safe;

CREATE VIEW public.verification_status_safe
WITH (security_barrier = true) AS
SELECT 
  wv.id,
  wv.user_id,
  -- Only show wallet address to the owner or service role
  CASE 
    WHEN auth.uid() = wv.user_id OR (auth.jwt() ->> 'role'::text) = 'service_role' 
    THEN wv.wallet_address
    ELSE '[PROTECTED]'::text
  END AS wallet_address,
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
WHERE 
  -- Enforce row-level security at view level
  auth.uid() = wv.user_id 
  OR (auth.jwt() ->> 'role'::text) = 'service_role';

-- Step 3: Set proper ownership and permissions
ALTER VIEW public.verification_status_safe OWNER TO postgres;

-- Step 4: Grant appropriate permissions
GRANT SELECT ON public.verification_status_safe TO authenticated;
GRANT ALL ON public.verification_status_safe TO service_role;

-- Step 5: Add documentation
COMMENT ON VIEW public.verification_status_safe IS 'Secure view of wallet verification status. Enforces RLS to show users only their own verification data. Service role has full access.';