-- =====================================================
-- DEFINITIVE FIX - Recreate views with proper GRANT/REVOKE
-- =====================================================

-- 1. Drop all views first
DROP VIEW IF EXISTS public.rooms_public CASCADE;
DROP VIEW IF EXISTS public.rooms_safe CASCADE;
DROP VIEW IF EXISTS public.lives_public CASCADE;
DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.live_consumption_safe CASCADE;
DROP VIEW IF EXISTS public.email_queue_summary CASCADE;
DROP VIEW IF EXISTS public.affiliate_transaction_summary CASCADE;
DROP VIEW IF EXISTS public.registration_referrals_safe CASCADE;

-- 2. Recreate rooms_public with security_invoker
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

REVOKE ALL ON public.rooms_public FROM PUBLIC;
REVOKE ALL ON public.rooms_public FROM anon;
GRANT SELECT ON public.rooms_public TO authenticated;

-- 3. Recreate rooms_safe (no stream_key)
CREATE VIEW public.rooms_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  creator_id,
  is_active,
  viewer_count,
  created_at,
  ended_at,
  title,
  daily_room_name
FROM public.rooms;

REVOKE ALL ON public.rooms_safe FROM PUBLIC;
REVOKE ALL ON public.rooms_safe FROM anon;
GRANT SELECT ON public.rooms_safe TO authenticated;

-- 4. Recreate lives_public (no percentages)
CREATE VIEW public.lives_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  creator_id,
  title,
  description,
  price,
  is_active,
  status,
  created_at,
  ended_at,
  room_name,
  thumbnail_url
FROM public.lives;

REVOKE ALL ON public.lives_public FROM PUBLIC;
REVOKE ALL ON public.lives_public FROM anon;
GRANT SELECT ON public.lives_public TO authenticated;

-- 5. Recreate public_profiles (truly public data only)
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  is_subscribed,
  created_at,
  youtube_handle,
  instagram_handle,
  tiktok_handle,
  facebook_handle,
  kwai_handle,
  website
FROM public.profiles
WHERE status = 'active';

REVOKE ALL ON public.public_profiles FROM PUBLIC;
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 6. Recreate service_role only views
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
FROM public.live_consumption;

REVOKE ALL ON public.live_consumption_safe FROM PUBLIC;
REVOKE ALL ON public.live_consumption_safe FROM anon;
REVOKE ALL ON public.live_consumption_safe FROM authenticated;
GRANT SELECT ON public.live_consumption_safe TO service_role;

-- 7. email_queue_summary
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
FROM public.email_queue;

REVOKE ALL ON public.email_queue_summary FROM PUBLIC;
REVOKE ALL ON public.email_queue_summary FROM anon;
REVOKE ALL ON public.email_queue_summary FROM authenticated;
GRANT SELECT ON public.email_queue_summary TO service_role;

-- 8. affiliate_transaction_summary
CREATE VIEW public.affiliate_transaction_summary
WITH (security_invoker = true)
AS
SELECT 
  id,
  affiliate_id,
  affiliate_amount,
  created_at,
  status
FROM public.transactions
WHERE affiliate_id IS NOT NULL AND affiliate_amount > 0;

REVOKE ALL ON public.affiliate_transaction_summary FROM PUBLIC;
REVOKE ALL ON public.affiliate_transaction_summary FROM anon;
REVOKE ALL ON public.affiliate_transaction_summary FROM authenticated;
GRANT SELECT ON public.affiliate_transaction_summary TO service_role;

-- 9. registration_referrals_safe
CREATE VIEW public.registration_referrals_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  referrer_id,
  referrer_parent_id,
  is_root_creator,
  is_free,
  created_at,
  completed_at,
  status,
  payment_id
FROM public.registration_referrals;

REVOKE ALL ON public.registration_referrals_safe FROM PUBLIC;
REVOKE ALL ON public.registration_referrals_safe FROM anon;
REVOKE ALL ON public.registration_referrals_safe FROM authenticated;
GRANT SELECT ON public.registration_referrals_safe TO service_role;