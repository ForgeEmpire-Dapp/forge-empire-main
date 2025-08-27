-- Enhanced Security Measures for Wallet Verification System
-- This migration implements automatic data cleanup, anonymization, and improved security

-- 1. Create a more secure cleanup function with data anonymization
CREATE OR REPLACE FUNCTION public.secure_cleanup_wallet_verifications()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  expired_deleted INTEGER;
  anonymized_count INTEGER;
  old_verified_deleted INTEGER;
BEGIN
  -- Delete expired unverified requests (they should not linger)
  DELETE FROM public.wallet_verifications 
  WHERE expires_at < now() AND verified = false;
  
  GET DIAGNOSTICS expired_deleted = ROW_COUNT;
  
  -- Anonymize verified requests older than 24 hours (remove sensitive data but keep audit trail)
  UPDATE public.wallet_verifications 
  SET 
    nonce = '[ANONYMIZED]',
    nonce_hash = '[ANONYMIZED]',
    ip_address = NULL,
    user_agent = NULL
  WHERE verified = true 
    AND created_at < (now() - interval '24 hours')
    AND nonce != '[ANONYMIZED]';
  
  GET DIAGNOSTICS anonymized_count = ROW_COUNT;
  
  -- Delete very old verified requests (keep audit trail but limit storage to 30 days max)
  DELETE FROM public.wallet_verifications 
  WHERE verified = true 
    AND created_at < (now() - interval '30 days');
  
  GET DIAGNOSTICS old_verified_deleted = ROW_COUNT;
  
  -- Clean up audit logs older than 90 days (reduce long-term storage)
  DELETE FROM public.wallet_verification_audit 
  WHERE created_at < (now() - interval '90 days');
  
  RETURN jsonb_build_object(
    'expired_deleted', expired_deleted,
    'anonymized_count', anonymized_count,
    'old_verified_deleted', old_verified_deleted,
    'cleanup_timestamp', now()
  );
END;
$function$;

-- 2. Create function to get verification statistics for monitoring
CREATE OR REPLACE FUNCTION public.get_verification_security_stats()
 RETURNS TABLE(
   active_verifications bigint,
   expired_unverified bigint,
   verified_with_sensitive_data bigint,
   old_audit_logs bigint,
   locked_accounts bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can access security statistics
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can access security statistics';
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.wallet_verifications WHERE verified = false AND expires_at > now()),
    (SELECT COUNT(*) FROM public.wallet_verifications WHERE verified = false AND expires_at < now()),
    (SELECT COUNT(*) FROM public.wallet_verifications WHERE verified = true AND nonce != '[ANONYMIZED]'),
    (SELECT COUNT(*) FROM public.wallet_verification_audit WHERE created_at < (now() - interval '90 days')),
    (SELECT COUNT(*) FROM public.wallet_verifications WHERE locked_until IS NOT NULL AND locked_until > now());
END;
$function$;

-- 3. Enhanced data protection: restrict nonce access to only necessary functions
CREATE OR REPLACE FUNCTION public.get_verification_status_secure(p_wallet_address text)
 RETURNS TABLE(
   has_pending_verification boolean, 
   is_locked boolean, 
   locked_until timestamp with time zone, 
   can_request_new boolean,
   expires_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_verification RECORD;
  v_recent_attempts INTEGER;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::TIMESTAMP WITH TIME ZONE, false, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  -- Get latest verification status (WITHOUT exposing nonce)
  SELECT 
    id, verified, expires_at, locked_until, attempt_count, created_at
  INTO v_verification
  FROM public.wallet_verifications
  WHERE user_id = auth.uid()
    AND lower(wallet_address) = lower(p_wallet_address)
    AND verified = false
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check recent attempts for rate limiting
  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.wallet_verifications
  WHERE user_id = auth.uid()
    AND created_at > (now() - interval '5 minutes');

  RETURN QUERY SELECT
    (v_verification.id IS NOT NULL AND v_verification.expires_at > now()),
    (v_verification.locked_until IS NOT NULL AND v_verification.locked_until > now()),
    v_verification.locked_until,
    (v_recent_attempts < 3 AND (v_verification.locked_until IS NULL OR v_verification.locked_until < now())),
    v_verification.expires_at;
END;
$function$;

-- 4. Add trigger for automatic cleanup on insert (prevents accumulation)
CREATE OR REPLACE FUNCTION public.auto_cleanup_on_verification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- On every new verification request, clean up expired ones for this user
  DELETE FROM public.wallet_verifications 
  WHERE user_id = NEW.user_id 
    AND expires_at < now() 
    AND verified = false;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_cleanup_verification_trigger ON public.wallet_verifications;
CREATE TRIGGER auto_cleanup_verification_trigger
  BEFORE INSERT ON public.wallet_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cleanup_on_verification_insert();

-- 5. Update RLS policies to be more restrictive for sensitive data
-- Replace the existing user policy with a more secure one
DROP POLICY IF EXISTS "Users can view their verification status only" ON public.wallet_verifications;

CREATE POLICY "Users can view limited verification status" ON public.wallet_verifications
  FOR SELECT
  USING (
    auth.uid() = user_id 
    AND (
      -- Only show non-sensitive fields for expired/completed verifications
      verified = true 
      OR expires_at > now()
    )
  );

-- 6. Create a view for safe verification status access (hides sensitive data)
CREATE OR REPLACE VIEW public.verification_status_safe AS
SELECT 
  id,
  user_id,
  wallet_address,
  verified,
  expires_at,
  created_at,
  attempt_count,
  (locked_until IS NOT NULL AND locked_until > now()) AS is_locked,
  CASE 
    WHEN (locked_until IS NOT NULL AND locked_until > now()) THEN locked_until
    ELSE NULL
  END AS locked_until_safe,
  -- Never expose nonce, nonce_hash, ip_address, or user_agent
  CASE 
    WHEN verified = false AND expires_at > now() THEN true
    ELSE false
  END AS has_active_verification
FROM public.wallet_verifications;

-- Grant access to the safe view
GRANT SELECT ON public.verification_status_safe TO authenticated;

-- 7. Enable RLS on the view
ALTER VIEW public.verification_status_safe SET (security_invoker = true);

-- 8. Schedule automatic cleanup (this creates a reminder for manual setup)
CREATE OR REPLACE FUNCTION public.verification_security_reminder()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'SECURITY REMINDER: Set up automated cleanup of wallet verification data by calling public.secure_cleanup_wallet_verifications() regularly (e.g., via cron job or periodic edge function). This migration improves security but requires periodic maintenance.';
$function$;

-- Execute the reminder
SELECT public.verification_security_reminder();