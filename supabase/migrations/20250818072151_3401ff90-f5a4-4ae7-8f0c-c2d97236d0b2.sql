-- Clean up redundant/insecure storage policies and keep only secure ones
DROP POLICY IF EXISTS "Allow public avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public avatar updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public avatar deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public banner uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public banner updates" ON storage.objects;  
DROP POLICY IF EXISTS "Allow public banner deletes" ON storage.objects;

-- Remove duplicate secure policies if they exist
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own banner" ON storage.objects;