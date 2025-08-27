-- Drop existing storage policies that require auth.uid()
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own banner" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own banner" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own banner" ON storage.objects;

-- Create new policies that allow public access for wallet-based uploads
-- Since we're using wallet addresses in the folder structure, we can allow public uploads
CREATE POLICY "Allow public avatar uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow public avatar updates"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow public avatar deletes"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars');

CREATE POLICY "Allow public banner uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Allow public banner updates"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'banners')
WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Allow public banner deletes"
ON storage.objects
FOR DELETE
USING (bucket_id = 'banners');