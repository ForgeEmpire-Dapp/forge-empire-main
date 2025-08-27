-- Security Fix: Add RLS policies to wallet_verification_status table

-- Enable Row Level Security
ALTER TABLE public.wallet_verification_status ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own verification status
CREATE POLICY "Users can view their own verification status"
ON public.wallet_verification_status
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can view all verification statuses  
CREATE POLICY "Admins can view all verification statuses"
ON public.wallet_verification_status
FOR SELECT
USING (public.is_admin());

-- Policy: Service role can manage verification status records
CREATE POLICY "Service role can manage verification status"
ON public.wallet_verification_status
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Policy: Database functions can manage verification status
CREATE POLICY "Database functions can manage verification status"
ON public.wallet_verification_status
FOR ALL
USING ((CURRENT_USER = 'supabase_admin'::name) OR (CURRENT_USER = 'postgres'::name));

-- Add index for performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_wallet_verification_status_user_id 
ON public.wallet_verification_status(user_id);

-- Add index for performance on wallet_address lookups
CREATE INDEX IF NOT EXISTS idx_wallet_verification_status_wallet_address 
ON public.wallet_verification_status(wallet_address);