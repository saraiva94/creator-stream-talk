-- =====================================================
-- SECURITY FIX: Add RLS policies to exposed views
-- =====================================================

-- 1. FIX: public_profiles view - Already a view, need to add RLS-like access control
-- Drop and recreate the view with security_invoker to inherit RLS from base table
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  referral_code,
  youtube_handle,
  instagram_handle,
  tiktok_handle,
  facebook_handle,
  kwai_handle,
  website,
  is_subscribed,
  created_at
FROM public.profiles;

-- Grant access to authenticated users only (not anon)
GRANT SELECT ON public.public_profiles TO authenticated;

-- 2. FIX: rooms_public view - Restrict to authenticated users only
DROP VIEW IF EXISTS public.rooms_public;

CREATE VIEW public.rooms_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  creator_id,
  is_active,
  viewer_count,
  created_at,
  ended_at,
  daily_room_name,
  title
FROM public.rooms
WHERE is_active = true;

-- Grant access to authenticated users only
GRANT SELECT ON public.rooms_public TO authenticated;

-- 3. FIX: live_consumption_safe view - Restrict to own data only
DROP VIEW IF EXISTS public.live_consumption_safe;

CREATE VIEW public.live_consumption_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  live_id,
  user_id,
  seconds_watched,
  credits_consumed,
  started_at,
  ended_at,
  last_heartbeat_at
FROM public.live_consumption
WHERE user_id = auth.uid();

-- Grant access to authenticated users only
GRANT SELECT ON public.live_consumption_safe TO authenticated;

-- 4. FIX: email_queue_summary view - Restrict to own data or admins
DROP VIEW IF EXISTS public.email_queue_summary;

CREATE VIEW public.email_queue_summary
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  sent_at,
  created_at,
  email_type,
  status
FROM public.email_queue
WHERE user_id = auth.uid() 
   OR public.has_role(auth.uid(), 'admin');

-- Grant access to authenticated users only
GRANT SELECT ON public.email_queue_summary TO authenticated;