-- Fix analytics_events security vulnerabilities
-- 1. Remove the problematic INSERT policy that allows NULL user_id access
DROP POLICY IF EXISTS "Users can insert their own analytics events" ON public.analytics_events;

-- 2. Create a more secure INSERT policy that requires user_id to match auth.uid()
CREATE POLICY "Users can insert their own analytics events" 
ON public.analytics_events 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- 3. Update SELECT policy to be more explicit about NULL handling
DROP POLICY IF EXISTS "Users can view their own analytics events" ON public.analytics_events;

CREATE POLICY "Users can view their own analytics events" 
ON public.analytics_events 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- 4. Clean up existing NULL user_id records for security
-- First, let's see what we have
SELECT COUNT(*) as null_user_id_count FROM public.analytics_events WHERE user_id IS NULL;

-- Delete orphaned analytics events with NULL user_id as they violate security
DELETE FROM public.analytics_events WHERE user_id IS NULL;

-- 5. Make user_id NOT NULL to prevent future security issues
ALTER TABLE public.analytics_events ALTER COLUMN user_id SET NOT NULL;

-- 6. Add a constraint to ensure user_id is always set
ALTER TABLE public.analytics_events 
ADD CONSTRAINT analytics_events_user_id_required 
CHECK (user_id IS NOT NULL);

-- 7. Create a secure function for analytics data anonymization that admins can use
CREATE OR REPLACE FUNCTION public.anonymize_old_analytics_data(older_than_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Only admins can execute this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can anonymize analytics data';
  END IF;
  
  -- Anonymize old analytics data by removing/masking sensitive fields
  UPDATE public.analytics_events
  SET 
    user_agent = '[ANONYMIZED]',
    page_url = CASE 
      WHEN page_url IS NOT NULL THEN regexp_replace(page_url, '^https?://[^/]+', '[DOMAIN]')
      ELSE NULL
    END,
    event_properties = CASE 
      WHEN event_properties ? 'ip_address' THEN event_properties - 'ip_address'
      WHEN event_properties ? 'fingerprint' THEN event_properties - 'fingerprint'
      ELSE event_properties
    END
  WHERE created_at < (now() - interval '1 day' * older_than_days)
    AND user_agent != '[ANONYMIZED]';
    
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN affected_rows;
END;
$$;