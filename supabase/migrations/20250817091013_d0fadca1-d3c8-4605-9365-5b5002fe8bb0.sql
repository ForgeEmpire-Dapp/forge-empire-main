-- FIX: Address Security Definer View warning
-- Replace security_barrier view with proper RLS policies

-- Step 1: Drop the current view
DROP VIEW IF EXISTS public.verification_status_safe;

-- Step 2: Create a regular view without security_barrier
CREATE VIEW public.verification_status_safe AS
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
FROM public.wallet_verifications wv;

-- Step 3: Enable RLS on the view itself
ALTER VIEW public.verification_status_safe SET ROW SECURITY;

-- Step 4: Create RLS policies for the view
CREATE POLICY "Users can view their own verification status" 
ON public.verification_status_safe 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (auth.jwt() ->> 'role'::text) = 'service_role'
);

-- Step 5: Set proper ownership and permissions
ALTER VIEW public.verification_status_safe OWNER TO postgres;
GRANT SELECT ON public.verification_status_safe TO authenticated;
GRANT ALL ON public.verification_status_safe TO service_role;

-- Step 6: Add documentation
COMMENT ON VIEW public.verification_status_safe IS 'Secure view of wallet verification status with RLS. Shows users only their own verification data, service role has full access.';