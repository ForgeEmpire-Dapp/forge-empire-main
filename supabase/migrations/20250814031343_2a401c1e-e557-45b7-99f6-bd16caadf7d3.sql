-- Step 1: Update profiles table structure to support proper authentication
-- Add user_id column to link with auth.users table
ALTER TABLE public.profiles 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Drop all existing insecure RLS policies
DROP POLICY IF EXISTS "Enable public read access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable public insert access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable public update access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable public delete access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Step 3: Create secure RLS policies based on authentication
-- Allow users to view all profiles (public read)
CREATE POLICY "Anyone can view profiles"
ON public.profiles FOR SELECT
USING (true);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update only their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete only their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 4: Create a function to handle profile creation with wallet integration
CREATE OR REPLACE FUNCTION public.create_profile_with_wallet(
  wallet_address TEXT,
  profile_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  profile_id UUID;
BEGIN
  -- Get the current authenticated user ID
  new_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF new_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create profile';
  END IF;
  
  -- Check if profile already exists for this user
  SELECT id INTO profile_id
  FROM public.profiles 
  WHERE user_id = new_user_id;
  
  IF profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profile already exists for this user';
  END IF;
  
  -- Create the profile
  INSERT INTO public.profiles (
    user_id,
    user_address,
    username,
    bio,
    display_name,
    location,
    website,
    social_links
  ) VALUES (
    new_user_id,
    LOWER(wallet_address),
    COALESCE(profile_data->>'username', NULL),
    COALESCE(profile_data->>'bio', NULL),
    COALESCE(profile_data->>'display_name', NULL),
    COALESCE(profile_data->>'location', NULL),
    COALESCE(profile_data->>'website', NULL),
    COALESCE(profile_data->'social_links', '{}'::JSONB)
  ) RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$;

-- Step 5: Create function to link existing profiles to users when they authenticate
CREATE OR REPLACE FUNCTION public.link_wallet_to_user(wallet_address TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  profile_id UUID;
  existing_profile RECORD;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already has a profile
  SELECT id INTO profile_id
  FROM public.profiles 
  WHERE user_id = current_user_id;
  
  IF profile_id IS NOT NULL THEN
    -- User already has a profile, return it
    RETURN profile_id;
  END IF;
  
  -- Look for existing profile with this wallet address but no user_id
  SELECT * INTO existing_profile
  FROM public.profiles 
  WHERE user_address = LOWER(wallet_address) AND user_id IS NULL
  LIMIT 1;
  
  IF existing_profile.id IS NOT NULL THEN
    -- Link existing profile to authenticated user
    UPDATE public.profiles 
    SET user_id = current_user_id,
        updated_at = NOW()
    WHERE id = existing_profile.id;
    
    RETURN existing_profile.id;
  ELSE
    -- Create new profile for this wallet
    INSERT INTO public.profiles (user_id, user_address)
    VALUES (current_user_id, LOWER(wallet_address))
    RETURNING id INTO profile_id;
    
    RETURN profile_id;
  END IF;
END;
$$;