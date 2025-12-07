-- Add new social media columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS facebook_handle text,
ADD COLUMN IF NOT EXISTS kwai_handle text,
ADD COLUMN IF NOT EXISTS youtube_handle text,
ADD COLUMN IF NOT EXISTS website text;