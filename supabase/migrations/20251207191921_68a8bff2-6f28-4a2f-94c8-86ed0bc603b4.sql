-- Fix security definer view by setting security_invoker = true
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
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
FROM public.profiles;

-- Grant select to anon and authenticated so public profiles can be viewed
GRANT SELECT ON public.public_profiles TO anon, authenticated;