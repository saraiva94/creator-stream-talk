-- Enable RLS on public_profiles view (it's a view, so we need to use security_invoker)
-- First, recreate the view with security_invoker = true
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

-- Grant access to authenticated and anon users
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Enable RLS on rooms_public view
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

-- Grant access to authenticated users only for rooms
GRANT SELECT ON public.rooms_public TO authenticated;