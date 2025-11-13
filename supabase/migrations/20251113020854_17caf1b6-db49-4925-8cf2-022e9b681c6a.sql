-- Add profile fields for user profile panel
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS gender text;

-- Add comment for gender field (expected values: male, female, other, prefer_not_to_say)
COMMENT ON COLUMN public.profiles.gender IS 'User gender: male, female, other, prefer_not_to_say';