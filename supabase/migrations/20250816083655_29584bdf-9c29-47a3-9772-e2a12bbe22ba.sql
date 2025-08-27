-- Fix security warnings by setting proper search paths for functions

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Fix anonymize_analytics_data function
CREATE OR REPLACE FUNCTION public.anonymize_analytics_data(older_than_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Only admins can execute this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can anonymize analytics data';
  END IF;
  
  -- Anonymize old analytics data by removing sensitive fields
  UPDATE public.analytics_events
  SET 
    user_agent = '[ANONYMIZED]',
    page_url = '[ANONYMIZED]',
    event_properties = CASE 
      WHEN event_properties ? 'ip_address' THEN event_properties - 'ip_address'
      ELSE event_properties
    END
  WHERE created_at < (now() - interval '1 day' * older_than_days)
    AND user_agent != '[ANONYMIZED]';
    
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN affected_rows;
END;
$$;

-- Fix get_analytics_summary function
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
  start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '7 days'),
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  event_name TEXT,
  event_count BIGINT,
  unique_users BIGINT,
  date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can access analytics summaries
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can access analytics summaries';
  END IF;
  
  RETURN QUERY
  SELECT 
    ae.event_name,
    COUNT(*) as event_count,
    COUNT(DISTINCT ae.user_id) as unique_users,
    ae.created_at::DATE as date
  FROM public.analytics_events ae
  WHERE ae.created_at::DATE BETWEEN start_date AND end_date
    AND ae.user_id IS NOT NULL
  GROUP BY ae.event_name, ae.created_at::DATE
  ORDER BY date DESC, event_count DESC;
END;
$$;