-- Fix critical security vulnerability in analytics_events table
-- Issue: User wallet addresses and sensitive data in event_properties could be accessed inappropriately

-- First, clean up existing data by removing wallet addresses from event_properties
UPDATE public.analytics_events 
SET event_properties = event_properties - 'wallet_address'
WHERE event_properties ? 'wallet_address';

-- Add trigger to automatically sanitize data on insert
CREATE OR REPLACE FUNCTION public.sanitize_analytics_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove sensitive data from event_properties automatically
  NEW.event_properties = NEW.event_properties 
    - 'wallet_address' 
    - 'privateKey' 
    - 'password' 
    - 'secret' 
    - 'token'
    - 'private_key'
    - 'auth_token'
    - 'session_id'
    - 'csrf_token';
  
  -- Remove detailed page URLs and user agents for privacy
  NEW.page_url = NULL;
  NEW.user_agent = NULL;
  NEW.user_address = NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sanitize on insert/update
DROP TRIGGER IF EXISTS sanitize_analytics_on_insert ON public.analytics_events;
CREATE TRIGGER sanitize_analytics_on_insert
  BEFORE INSERT OR UPDATE ON public.analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_analytics_data();

-- Remove all existing policies and create secure ones
DROP POLICY IF EXISTS "Admins can manage analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Admins can view all analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Only admins can view analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can insert their own analytics events only" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can view own analytics summary" ON public.analytics_events;

-- Create secure policies
-- 1. Users can only insert their own events (no SELECT on individual rows)
CREATE POLICY "Authenticated users can insert own events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  user_id IS NOT NULL AND
  event_name NOT IN ('password_reset', 'email_change', 'phone_change', 'security_event')
);

-- 2. Only admins can view analytics data
CREATE POLICY "Only admins can view analytics"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3. Only admins can manage analytics
CREATE POLICY "Only admins can manage analytics"
ON public.analytics_events
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Service role can manage for edge functions
CREATE POLICY "Service role can manage analytics"
ON public.analytics_events
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role');

-- Update the user analytics summary function to be more restrictive
CREATE OR REPLACE FUNCTION public.get_user_analytics_summary(days_back integer DEFAULT 30)
RETURNS TABLE(event_name text, event_count bigint, first_seen timestamp with time zone, last_seen timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Users can only see aggregated counts of their own data (no sensitive details)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  RETURN QUERY
  SELECT 
    ae.event_name,
    COUNT(*) as event_count,
    MIN(ae.created_at) as first_seen,
    MAX(ae.created_at) as last_seen
  FROM public.analytics_events ae
  WHERE ae.user_id = auth.uid()
    AND ae.created_at >= (now() - interval '1 day' * days_back)
  GROUP BY ae.event_name
  ORDER BY event_count DESC;
END;
$function$;