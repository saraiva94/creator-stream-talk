-- Drop the view
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate with explicit SECURITY INVOKER
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
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

-- Grant SELECT access
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;