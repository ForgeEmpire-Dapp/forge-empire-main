-- Fix RLS policy for analytics_events to handle edge cases
-- Drop existing INSERT policy and create a more robust one
DROP POLICY IF EXISTS "Users can insert their own analytics events" ON public.analytics_events;

-- Create new INSERT policy that allows authenticated users to insert events
-- but still requires user_id to match auth.uid() when user_id is provided
CREATE POLICY "Authenticated users can insert analytics events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND 
  (user_id IS NULL OR auth.uid() = user_id)
);

-- Also ensure the user_id column can be NOT NULL by default using auth.uid()
-- Update the table to set a default value for user_id
ALTER TABLE public.analytics_events 
ALTER COLUMN user_id SET DEFAULT auth.uid();