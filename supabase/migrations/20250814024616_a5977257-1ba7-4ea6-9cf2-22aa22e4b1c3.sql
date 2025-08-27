-- Drop existing RLS policies that might be blocking wallet-based operations
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new policies that allow public access for wallet-based profiles
-- Since we're using wallet addresses as identification, allow public operations
CREATE POLICY "Enable public read access on profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Enable public insert access on profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Enable public update access on profiles"
ON public.profiles FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable public delete access on profiles"
ON public.profiles FOR DELETE
USING (true);