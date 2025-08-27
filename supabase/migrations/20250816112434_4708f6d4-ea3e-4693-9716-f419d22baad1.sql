-- Create wallet verification table for secure wallet linking
CREATE TABLE public.wallet_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies for wallet verifications
CREATE POLICY "Users can create their own verification requests" 
ON public.wallet_verifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own verification requests" 
ON public.wallet_verifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own verification requests" 
ON public.wallet_verifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all verifications" 
ON public.wallet_verifications 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Add unique constraint to prevent multiple active verification requests
CREATE UNIQUE INDEX idx_wallet_verifications_active 
ON public.wallet_verifications (user_id, wallet_address) 
WHERE verified = false;

-- Add index for cleanup
CREATE INDEX idx_wallet_verifications_expires_at 
ON public.wallet_verifications (expires_at);

-- Create function to clean up expired verifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_verifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.wallet_verifications 
  WHERE expires_at < now() AND verified = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Update get_public_profiles to remove wallet address exposure
CREATE OR REPLACE FUNCTION public.get_public_profiles_secure(limit_count integer DEFAULT 20)
RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text, created_at timestamp with time zone, visibility text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.created_at,
    p.visibility
  FROM public.profiles p
  WHERE p.visibility = 'public'
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$function$;