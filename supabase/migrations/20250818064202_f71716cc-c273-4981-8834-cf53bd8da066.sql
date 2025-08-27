-- Enhanced Analytics Security Migration
-- This migration addresses the security concerns around analytics data

-- 1. First, create a more secure analytics cleanup function with automatic anonymization
CREATE OR REPLACE FUNCTION public.secure_analytics_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  anonymized_count INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Only service role or admins can execute this function
  IF NOT (public.is_admin() OR (auth.jwt() ->> 'role'::text) = 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or service role can cleanup analytics data';
  END IF;
  
  -- Anonymize analytics data older than 7 days (remove PII but keep counts for analytics)
  UPDATE public.analytics_events
  SET 
    user_agent = '[ANONYMIZED]',
    page_url = CASE 
      WHEN page_url IS NOT NULL THEN regexp_replace(page_url, '^https?://[^/]+', '[DOMAIN]')
      ELSE NULL
    END,
    user_address = NULL, -- Remove wallet addresses completely after 7 days
    event_properties = CASE 
      WHEN event_properties ? 'ip_address' THEN event_properties - 'ip_address'
      WHEN event_properties ? 'fingerprint' THEN event_properties - 'fingerprint' 
      WHEN event_properties ? 'session_id' THEN event_properties - 'session_id'
      ELSE event_properties
    END
  WHERE created_at < (now() - interval '7 days')
    AND user_agent != '[ANONYMIZED]';
    
  GET DIAGNOSTICS anonymized_count = ROW_COUNT;
  
  -- Delete very old analytics events (older than 90 days) to limit data retention
  DELETE FROM public.analytics_events 
  WHERE created_at < (now() - interval '90 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'anonymized_count', anonymized_count,
    'deleted_count', deleted_count,
    'cleanup_timestamp', now(),
    'retention_policy', '7 days for PII, 90 days total'
  );
END;
$$;

-- 2. Create a secure function for users to view ONLY their own analytics summary
CREATE OR REPLACE FUNCTION public.get_user_analytics_summary(days_back integer DEFAULT 30)
RETURNS TABLE(
  event_name text,
  event_count bigint,
  first_seen timestamp with time zone,
  last_seen timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Users can only see their own analytics data
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
$$;

-- 3. Create a data minimization trigger to automatically clean sensitive data on insert
CREATE OR REPLACE FUNCTION public.minimize_analytics_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Truncate user agent to remove detailed fingerprinting info (keep browser family only)
  IF NEW.user_agent IS NOT NULL THEN
    NEW.user_agent := CASE
      WHEN NEW.user_agent ILIKE '%chrome%' THEN 'Chrome'
      WHEN NEW.user_agent ILIKE '%firefox%' THEN 'Firefox' 
      WHEN NEW.user_agent ILIKE '%safari%' THEN 'Safari'
      WHEN NEW.user_agent ILIKE '%edge%' THEN 'Edge'
      ELSE 'Other'
    END;
  END IF;
  
  -- Remove query parameters and sensitive info from page URLs
  IF NEW.page_url IS NOT NULL THEN
    NEW.page_url := regexp_replace(NEW.page_url, '\?.*$', '');
    NEW.page_url := regexp_replace(NEW.page_url, '#.*$', '');
  END IF;
  
  -- Remove sensitive properties from event_properties
  IF NEW.event_properties IS NOT NULL THEN
    NEW.event_properties := NEW.event_properties 
      - 'ip_address' 
      - 'fingerprint' 
      - 'session_id'
      - 'csrf_token'
      - 'auth_token';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Apply the data minimization trigger
DROP TRIGGER IF EXISTS minimize_analytics_on_insert ON public.analytics_events;
CREATE TRIGGER minimize_analytics_on_insert
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION public.minimize_analytics_data();

-- 5. Enhanced RLS policy to ensure users can only access their own data
DROP POLICY IF EXISTS "Users can view own analytics summary" ON public.analytics_events;
CREATE POLICY "Users can view own analytics summary"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  AND created_at >= (now() - interval '30 days') -- Limit to recent data only
);

-- 6. Create automatic cleanup job (to be called periodically by edge function)
CREATE OR REPLACE FUNCTION public.schedule_analytics_cleanup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cleanup_result JSONB;
BEGIN
  -- Only service role can execute scheduled cleanup
  IF (auth.jwt() ->> 'role'::text) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only service role can schedule cleanup';
  END IF;
  
  -- Perform the cleanup
  SELECT public.secure_analytics_cleanup() INTO cleanup_result;
  
  RETURN 'Analytics cleanup completed: ' || cleanup_result::text;
END;
$$;

-- 7. Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_cleanup 
ON public.analytics_events (created_at, user_agent) 
WHERE user_agent != '[ANONYMIZED]';

-- 8. Security audit function for monitoring
CREATE OR REPLACE FUNCTION public.get_analytics_security_status()
RETURNS TABLE(
  total_events bigint,
  events_with_pii bigint,
  events_anonymized bigint,
  oldest_event_date timestamp with time zone,
  retention_compliance boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only admins can check security status
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can check analytics security status';
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.analytics_events),
    (SELECT COUNT(*) FROM public.analytics_events WHERE user_agent != '[ANONYMIZED]' AND user_agent IS NOT NULL),
    (SELECT COUNT(*) FROM public.analytics_events WHERE user_agent = '[ANONYMIZED]'),
    (SELECT MIN(created_at) FROM public.analytics_events),
    (SELECT MIN(created_at) FROM public.analytics_events) > (now() - interval '90 days')
  ;
END;
$$;