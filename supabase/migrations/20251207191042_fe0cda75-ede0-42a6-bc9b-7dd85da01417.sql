-- Add social media columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN instagram_handle TEXT DEFAULT NULL,
ADD COLUMN twitter_handle TEXT DEFAULT NULL,
ADD COLUMN tiktok_handle TEXT DEFAULT NULL;

-- Remove website column since it's being replaced by social media
ALTER TABLE public.profiles DROP COLUMN IF EXISTS website;