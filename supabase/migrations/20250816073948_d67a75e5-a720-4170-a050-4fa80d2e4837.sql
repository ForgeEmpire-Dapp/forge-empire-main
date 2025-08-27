-- Fix critical RLS security issues

-- 1. Fix notifications table RLS policies
-- Remove overly permissive system insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create restricted policy for notifications - only allow service role or edge functions
CREATE POLICY "Service role can manage notifications" 
ON public.notifications 
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 2. Fix social_stats_cache RLS policies  
-- Remove overly permissive system update policy
DROP POLICY IF EXISTS "System can update social stats cache" ON public.social_stats_cache;

-- Create restricted policy for social stats - only service role can modify
CREATE POLICY "Service role can manage social stats" 
ON public.social_stats_cache 
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Keep read access for everyone
CREATE POLICY "Public read access to social stats" 
ON public.social_stats_cache 
FOR SELECT 
USING (true);

-- 3. Create storage policies for avatar and banner buckets
-- Avatars bucket policies
INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('avatars', '.emptyFolderPlaceholder', null, '{}') ON CONFLICT DO NOTHING;

CREATE POLICY "Users can view avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Banners bucket policies
INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('banners', '.emptyFolderPlaceholder', null, '{}') ON CONFLICT DO NOTHING;

CREATE POLICY "Users can view banners" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'banners');

CREATE POLICY "Users can upload their own banner" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'banners' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own banner" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'banners' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'banners' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own banner" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'banners' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);