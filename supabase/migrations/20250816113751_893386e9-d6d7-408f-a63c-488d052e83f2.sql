-- Enable leaked password protection and update auth configuration
-- Note: This requires manual configuration in Supabase Dashboard

-- Create a reminder function for the admin
CREATE OR REPLACE FUNCTION public.security_reminder()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'SECURITY REMINDER: Please enable leaked password protection in Supabase Dashboard > Authentication > Settings. This migration creates tables and policies but password protection must be enabled manually.';
$$;