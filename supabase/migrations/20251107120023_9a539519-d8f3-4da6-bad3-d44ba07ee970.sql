-- Add subscription field to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_subscribed boolean DEFAULT false;

-- Add index for better performance
CREATE INDEX idx_profiles_is_subscribed ON public.profiles(is_subscribed);