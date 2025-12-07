-- 1. Recriar public_profiles com security_invoker
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.is_subscribed,
  p.created_at,
  p.username,
  p.avatar_url,
  p.bio,
  p.referral_code,
  p.youtube_handle,
  p.instagram_handle,
  p.tiktok_handle,
  p.facebook_handle,
  p.kwai_handle,
  p.website
FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 2. Recriar rooms_public com security_invoker (apenas authenticated)
DROP VIEW IF EXISTS public.rooms_public;

CREATE VIEW public.rooms_public 
WITH (security_invoker = true)
AS
SELECT 
  r.id,
  r.creator_id,
  r.is_active,
  r.viewer_count,
  r.created_at,
  r.ended_at,
  r.daily_room_name,
  r.title
FROM public.rooms r
WHERE r.is_active = true;

GRANT SELECT ON public.rooms_public TO authenticated;