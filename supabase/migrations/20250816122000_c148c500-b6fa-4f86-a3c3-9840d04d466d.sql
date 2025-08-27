-- Security Fix: Replace wallet_verification_status view with secure function

-- Drop the existing view as it's not the proper way to handle RLS
DROP VIEW IF EXISTS public.wallet_verification_status;

-- Create a secure function to get wallet verification status
CREATE OR REPLACE FUNCTION public.get_wallet_verification_status(p_wallet_address text DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  wallet_address text,
  verified boolean,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  is_locked boolean,
  locked_until_public timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only authenticated users can check verification status
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    wv.id,
    wv.user_id,
    wv.wallet_address,
    wv.verified,
    wv.expires_at,
    wv.created_at,
    (wv.locked_until IS NOT NULL AND wv.locked_until > now()) AS is_locked,
    CASE 
      WHEN (wv.locked_until IS NOT NULL AND wv.locked_until > now()) THEN wv.locked_until
      ELSE NULL
    END AS locked_until_public
  FROM public.wallet_verifications wv
  WHERE wv.user_id = auth.uid()
    AND (p_wallet_address IS NULL OR lower(wv.wallet_address) = lower(p_wallet_address))
  ORDER BY wv.created_at DESC;
END;
$function$;

-- Grant usage to authenticated users
GRANT EXECUTE ON FUNCTION public.get_wallet_verification_status(text) TO authenticated;