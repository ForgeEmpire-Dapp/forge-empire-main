-- Phase 1: Create critical security triggers

-- Create trigger to sanitize analytics data on insert/update
DROP TRIGGER IF EXISTS sanitize_analytics_trigger ON public.analytics_events;
CREATE TRIGGER sanitize_analytics_trigger
  BEFORE INSERT OR UPDATE ON public.analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_analytics_data();

-- Create trigger to auto-cleanup expired wallet verifications on insert
DROP TRIGGER IF EXISTS auto_cleanup_verifications_trigger ON public.wallet_verifications;
CREATE TRIGGER auto_cleanup_verifications_trigger
  BEFORE INSERT ON public.wallet_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cleanup_on_verification_insert();

-- Phase 3: Create storage security policies for avatars bucket
CREATE POLICY "Avatars are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create storage security policies for banners bucket
CREATE POLICY "Banners are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'banners');

CREATE POLICY "Users can upload their own banner" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'banners' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own banner" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'banners' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own banner" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'banners' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);