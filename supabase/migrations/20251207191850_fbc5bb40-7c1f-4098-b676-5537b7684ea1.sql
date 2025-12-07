-- Drop and recreate public_profiles view to include social media fields
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  is_subscribed,
  referral_code,
  created_at,
  youtube_handle,
  instagram_handle,
  tiktok_handle,
  facebook_handle,
  kwai_handle,
  website
FROM public.profiles;