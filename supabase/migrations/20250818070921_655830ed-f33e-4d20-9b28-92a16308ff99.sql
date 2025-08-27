-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION public.sanitize_analytics_data()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;