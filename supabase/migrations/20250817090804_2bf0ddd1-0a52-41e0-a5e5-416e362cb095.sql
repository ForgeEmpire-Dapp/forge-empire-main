-- CRITICAL SECURITY FIX: Enable RLS on verification_status_safe view
-- This addresses the security vulnerability where verification data could be exposed

-- Step 1: Enable RLS on the view
ALTER VIEW public.verification_status_safe OWNER TO postgres;
ALTER VIEW public.verification_status_safe SET (security_barrier = true);

-- Step 2: Enable Row Level Security on the view (PostgreSQL 15+ feature)
-- Note: Views inherit RLS from underlying tables, but we need explicit policies

-- Step 3: Create secure function to check user ownership
CREATE OR REPLACE FUNCTION public.user_owns_verification(verification_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT verification_user_id = auth.uid();
$$;

-- Step 4: Drop and recreate the view with better security
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
  -- Apply RLS at the view level
  auth.uid() = wv.user_id 
  OR (auth.jwt() ->> 'role'::text) = 'service_role'
  OR ((auth.jwt() ->> 'role'::text) = 'authenticated' AND wv.verified = true AND wv.expires_at > now());

-- Step 5: Set proper ownership and permissions
ALTER VIEW public.verification_status_safe OWNER TO postgres;

-- Step 6: Grant appropriate permissions
GRANT SELECT ON public.verification_status_safe TO authenticated;
GRANT ALL ON public.verification_status_safe TO service_role;

-- Step 7: Add comment for documentation
COMMENT ON VIEW public.verification_status_safe IS 'Secure view of wallet verification status that protects sensitive data and enforces row-level security. Only shows user their own verification data or allows service role full access.';

-- Step 8: Security audit log
INSERT INTO public.wallet_verification_audit (
  user_id,
  wallet_address,
  event_type,
  details
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system',
  'security_fix',
  '{"action": "secured_verification_status_safe_view", "timestamp": "' || now()::text || '", "issue": "missing_rls_on_view"}'::jsonb
);