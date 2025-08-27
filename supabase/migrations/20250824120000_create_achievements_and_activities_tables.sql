-- Create achievements table
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL REFERENCES public.profiles(user_address) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rarity TEXT NOT NULL,
  category TEXT NOT NULL,
  earnedAt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  xpReward INTEGER
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Achievements are viewable by everyone" 
ON public.achievements 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own achievements" 
ON public.achievements 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_address);

-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL REFERENCES public.profiles(user_address) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  xpEarned INTEGER,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Activities are viewable by everyone" 
ON public.activities 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own activities" 
ON public.activities 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_address);
