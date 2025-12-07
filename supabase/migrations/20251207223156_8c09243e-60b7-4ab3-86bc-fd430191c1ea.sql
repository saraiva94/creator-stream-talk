-- =====================================================
-- FINAL SECURITY FIX: Use security_invoker = true (not security_barrier)
-- This ensures RLS from base tables is inherited
-- =====================================================

-- Drop all views first
DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.rooms_public CASCADE;
DROP VIEW IF EXISTS public.live_consumption_safe CASCADE;
DROP VIEW IF EXISTS public.email_queue_summary CASCADE;
DROP VIEW IF EXISTS public.registration_referrals_safe CASCADE;
DROP VIEW IF EXISTS public.affiliate_transaction_summary CASCADE;

-- 1. public_profiles - Inherits RLS from profiles table
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.bio,
  p.referral_code,
  p.youtube_handle,
  p.instagram_handle,
  p.tiktok_handle,
  p.facebook_handle,
  p.kwai_handle,
  p.website,
  p.is_subscribed,
  p.created_at
FROM public.profiles p;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 2. rooms_public - Inherits RLS from rooms table
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

-- 3. live_consumption_safe - Inherits RLS from live_consumption table
CREATE VIEW public.live_consumption_safe
WITH (security_invoker = true)
AS
SELECT 
  lc.id,
  lc.live_id,
  lc.user_id,
  lc.seconds_watched,
  lc.credits_consumed,
  lc.started_at,
  lc.ended_at,
  lc.last_heartbeat_at
FROM public.live_consumption lc;

REVOKE ALL ON public.live_consumption_safe FROM PUBLIC;
REVOKE ALL ON public.live_consumption_safe FROM anon;
GRANT SELECT ON public.live_consumption_safe TO authenticated;

-- 4. email_queue_summary - Inherits RLS from email_queue table
CREATE VIEW public.email_queue_summary
WITH (security_invoker = true)
AS
SELECT 
  eq.id,
  eq.user_id,
  eq.sent_at,
  eq.created_at,
  eq.email_type,
  eq.status
FROM public.email_queue eq;

REVOKE ALL ON public.email_queue_summary FROM PUBLIC;
REVOKE ALL ON public.email_queue_summary FROM anon;
GRANT SELECT ON public.email_queue_summary TO authenticated;

-- 5. registration_referrals_safe - Inherits RLS from registration_referrals table
CREATE VIEW public.registration_referrals_safe
WITH (security_invoker = true)
AS
SELECT 
  rr.id,
  rr.user_id,
  rr.referrer_id,
  rr.referrer_parent_id,
  rr.is_root_creator,
  rr.is_free,
  rr.created_at,
  rr.completed_at,
  rr.status,
  rr.payment_id
FROM public.registration_referrals rr;

REVOKE ALL ON public.registration_referrals_safe FROM PUBLIC;
REVOKE ALL ON public.registration_referrals_safe FROM anon;
GRANT SELECT ON public.registration_referrals_safe TO authenticated;

-- 6. affiliate_transaction_summary - Inherits RLS from transactions table  
CREATE VIEW public.affiliate_transaction_summary
WITH (security_invoker = true)
AS
SELECT 
  t.id,
  t.affiliate_id,
  t.affiliate_amount,
  t.created_at,
  t.status
FROM public.transactions t
WHERE t.affiliate_amount IS NOT NULL
  AND t.affiliate_amount > 0;

REVOKE ALL ON public.affiliate_transaction_summary FROM PUBLIC;
REVOKE ALL ON public.affiliate_transaction_summary FROM anon;
GRANT SELECT ON public.affiliate_transaction_summary TO authenticated;