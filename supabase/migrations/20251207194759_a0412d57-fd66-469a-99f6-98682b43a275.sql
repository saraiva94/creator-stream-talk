-- Drop the existing security definer view
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the view WITHOUT security definer (uses SECURITY INVOKER by default which is safer)
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  referral_code,
  is_subscribed,
  created_at,
  youtube_handle,
  instagram_handle,
  tiktok_handle,
  facebook_handle,
  kwai_handle,
  website
FROM public.profiles;

-- Grant SELECT access to all roles for public profile data
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;