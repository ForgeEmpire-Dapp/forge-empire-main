-- Create user roles system for secure analytics access control

-- 1. Create an enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    assigned_by UUID,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 5. Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- 6. RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 7. Update analytics_events table with improved security policies

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can insert their own analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can view their own analytics events" ON public.analytics_events;

-- Create new, more secure policies
CREATE POLICY "Users can insert their own analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR 
  (user_id IS NULL AND auth.uid() IS NOT NULL)
);

CREATE POLICY "Users can view their own analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage analytics events"
ON public.analytics_events
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 8. Add data anonymization function for privacy compliance
CREATE OR REPLACE FUNCTION public.anonymize_analytics_data(older_than_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 9. Create function to get analytics summary (admin only)
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