-- Drop and recreate the public_profiles view with security_invoker = false
-- This allows public read access without RLS restrictions
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = false)
AS
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
FROM profiles;

-- Grant access to anon and authenticated
GRANT SELECT ON public.public_profiles TO anon, authenticated;