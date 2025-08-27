-- Enhanced security for wallet verifications table
-- Add additional security columns and policies

-- Add security enhancement columns
ALTER TABLE public.wallet_verifications 
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS nonce_hash TEXT;

-- Create index for faster lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_cleanup 
ON public.wallet_verifications (expires_at, verified) 
WHERE verified = false;

CREATE INDEX IF NOT EXISTS idx_wallet_verifications_security 
ON public.wallet_verifications (ip_address, created_at) 
WHERE verified = false;

-- Enhanced security function to validate verification attempts
CREATE OR REPLACE FUNCTION public.validate_verification_attempt(
  p_user_id UUID,
  p_wallet_address TEXT,
  p_nonce TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE(
  is_valid BOOLEAN,
  error_message TEXT,
  verification_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_attempt_count INTEGER;
  v_ip_attempts INTEGER;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT false, 'Unauthorized access', NULL::UUID;
    RETURN;
  END IF;

  -- Check for recent IP-based attempts (rate limiting)
  SELECT COUNT(*) INTO v_ip_attempts
  FROM public.wallet_verifications 
  WHERE ip_address = p_ip_address 
    AND created_at > (now() - interval '1 hour');
    
  IF v_ip_attempts > 10 THEN
    RETURN QUERY SELECT false, 'Too many verification attempts from this IP', NULL::UUID;
    RETURN;
  END IF;

  -- Get verification record with all security checks
  SELECT * INTO v_verification
  FROM public.wallet_verifications
  WHERE user_id = p_user_id
    AND lower(wallet_address) = lower(p_wallet_address)
    AND nonce = p_nonce
    AND verified = false
    AND expires_at > now()
    AND (locked_until IS NULL OR locked_until < now())
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no valid verification found
  IF v_verification.id IS NULL THEN
    -- Log failed attempt for existing verification (if any)
    UPDATE public.wallet_verifications 
    SET 
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      locked_until = CASE 
        WHEN attempt_count >= 5 THEN now() + interval '1 hour'
        WHEN attempt_count >= 3 THEN now() + interval '15 minutes'
        ELSE locked_until
      END
    WHERE user_id = p_user_id
      AND lower(wallet_address) = lower(p_wallet_address)
      AND verified = false;
      
    RETURN QUERY SELECT false, 'Invalid or expired verification request', NULL::UUID;
    RETURN;
  END IF;

  -- Check attempt count and implement backoff
  IF v_verification.attempt_count >= 5 THEN
    UPDATE public.wallet_verifications 
    SET locked_until = now() + interval '1 hour'
    WHERE id = v_verification.id;
    
    RETURN QUERY SELECT false, 'Too many failed attempts. Try again in 1 hour.', NULL::UUID;
    RETURN;
  END IF;

  -- Update attempt tracking
  UPDATE public.wallet_verifications 
  SET 
    attempt_count = attempt_count + 1,
    last_attempt_at = now(),
    ip_address = COALESCE(ip_address, p_ip_address)
  WHERE id = v_verification.id;

  -- Return success
  RETURN QUERY SELECT true, 'Validation successful', v_verification.id;
END;
$$;

-- Function to securely create verification nonce
CREATE OR REPLACE FUNCTION public.create_secure_verification(
  p_user_id UUID,
  p_wallet_address TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(
  nonce TEXT,
  verification_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_nonce TEXT;
  v_nonce_hash TEXT;
  v_verification_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_recent_attempts INTEGER;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  -- Rate limiting: Check recent verification requests from this user
  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.wallet_verifications 
  WHERE user_id = p_user_id 
    AND created_at > (now() - interval '5 minutes');
    
  IF v_recent_attempts >= 3 THEN
    RAISE EXCEPTION 'Too many verification requests. Please wait before requesting another.';
  END IF;

  -- Rate limiting: Check recent requests from this IP
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent_attempts
    FROM public.wallet_verifications 
    WHERE ip_address = p_ip_address 
      AND created_at > (now() - interval '5 minutes');
      
    IF v_recent_attempts >= 5 THEN
      RAISE EXCEPTION 'Too many verification requests from this IP. Please wait.';
    END IF;
  END IF;

  -- Clean up old verification requests for this user/wallet combo
  DELETE FROM public.wallet_verifications 
  WHERE user_id = p_user_id 
    AND lower(wallet_address) = lower(p_wallet_address)
    AND verified = false;

  -- Generate cryptographically secure nonce (64 hex characters)
  v_nonce := encode(gen_random_bytes(32), 'hex');
  v_nonce_hash := encode(digest(v_nonce || p_user_id::text || p_wallet_address, 'sha256'), 'hex');
  v_expires_at := now() + interval '10 minutes';

  -- Insert new verification record
  INSERT INTO public.wallet_verifications (
    user_id,
    wallet_address,
    nonce,
    nonce_hash,
    expires_at,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    lower(p_wallet_address),
    v_nonce,
    v_nonce_hash,
    v_expires_at,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_verification_id;

  RETURN QUERY SELECT v_nonce, v_verification_id, v_expires_at;
END;
$$;

-- Function to complete verification with enhanced security
CREATE OR REPLACE FUNCTION public.complete_wallet_verification(
  p_verification_id UUID,
  p_signature TEXT,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  profile_id UUID,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_profile_id UUID;
BEGIN
  -- Get verification record with security checks
  SELECT * INTO v_verification
  FROM public.wallet_verifications
  WHERE id = p_verification_id
    AND user_id = auth.uid()
    AND verified = false
    AND expires_at > now()
    AND (locked_until IS NULL OR locked_until < now());

  -- Validate verification exists and is valid
  IF v_verification.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Invalid or expired verification';
    RETURN;
  END IF;

  -- Check attempt limits
  IF v_verification.attempt_count >= 5 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Too many failed attempts';
    RETURN;
  END IF;

  -- Verify IP consistency (if originally provided)
  IF v_verification.ip_address IS NOT NULL AND p_ip_address IS NOT NULL 
     AND v_verification.ip_address != p_ip_address THEN
    -- Log suspicious activity but don't block (IP can change)
    UPDATE public.wallet_verifications 
    SET attempt_count = attempt_count + 1
    WHERE id = p_verification_id;
  END IF;

  -- Mark verification as complete
  UPDATE public.wallet_verifications 
  SET 
    verified = true,
    last_attempt_at = now()
  WHERE id = p_verification_id;

  -- Link wallet to user profile using existing function
  SELECT link_wallet_to_user(v_verification.wallet_address) INTO v_profile_id;

  -- Clean up any other pending verifications for this user/wallet
  DELETE FROM public.wallet_verifications 
  WHERE user_id = v_verification.user_id 
    AND lower(wallet_address) = lower(v_verification.wallet_address)
    AND verified = false
    AND id != p_verification_id;

  RETURN QUERY SELECT true, v_profile_id, 'Wallet successfully verified and linked';
END;
$$;

-- Enhanced cleanup function with better security
CREATE OR REPLACE FUNCTION public.cleanup_wallet_verifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired unverified requests
  DELETE FROM public.wallet_verifications 
  WHERE expires_at < now() AND verified = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete very old verified requests (keep for audit trail but limit storage)
  DELETE FROM public.wallet_verifications 
  WHERE verified = true AND created_at < (now() - interval '30 days');
  
  RETURN deleted_count;
END;
$$;