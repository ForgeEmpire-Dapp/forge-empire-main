-- Update storage policies for better security
-- Make storage buckets private with controlled access

-- Update storage policies for avatars bucket
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

-- Create secure avatar policies
CREATE POLICY "Public read access for avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars with user prefix" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatars" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatars" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Update storage policies for banners bucket
DROP POLICY IF EXISTS "Anyone can view banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own banner" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own banner" ON storage.objects;

-- Create secure banner policies
CREATE POLICY "Public read access for banners" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'banners');

CREATE POLICY "Users can upload banners with user prefix" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'banners' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own banners" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'banners' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own banners" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'banners' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Remove duplicate policies on social_stats_cache
DROP POLICY IF EXISTS "Anyone can read social stats cache" ON public.social_stats_cache;

-- Update get_public_profiles function to not expose user_address for non-owners
CREATE OR REPLACE FUNCTION public.get_public_profiles_secure(limit_count integer DEFAULT 20)
 RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text, created_at timestamp with time zone, visibility text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.created_at,
    p.visibility
  FROM public.profiles p
  WHERE p.visibility = 'public'
  ORDER BY p.created_at DESC
  LIMIT limit_count;
END;
$function$;

-- Enable realtime for notifications with proper filtering
ALTER publication supabase_realtime ADD TABLE notifications;