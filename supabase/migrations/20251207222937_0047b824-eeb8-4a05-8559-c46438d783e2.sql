-- =====================================================
-- COMPREHENSIVE SECURITY FIX: All exposed views
-- =====================================================

-- 1. FIX: public_profiles - Recreate with WHERE clause for authenticated access
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
FROM public.profiles
WHERE auth.uid() IS NOT NULL;

REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 2. FIX: rooms_public - Require authentication
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
WHERE is_active = true
  AND auth.uid() IS NOT NULL;

REVOKE ALL ON public.rooms_public FROM anon;
GRANT SELECT ON public.rooms_public TO authenticated;

-- 3. FIX: live_consumption_safe - Own data only
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
WHERE auth.uid() IS NOT NULL 
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lives 
      WHERE lives.id = live_consumption.live_id 
      AND lives.creator_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

REVOKE ALL ON public.live_consumption_safe FROM anon;
GRANT SELECT ON public.live_consumption_safe TO authenticated;

-- 4. FIX: email_queue_summary - Own data or admin only
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
WHERE auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
  );

REVOKE ALL ON public.email_queue_summary FROM anon;
GRANT SELECT ON public.email_queue_summary TO authenticated;

-- 5. FIX: registration_referrals_safe - Own data or admin
DROP VIEW IF EXISTS public.registration_referrals_safe;

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
FROM public.registration_referrals
WHERE auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
    OR referrer_id = auth.uid()
    OR referrer_parent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

REVOKE ALL ON public.registration_referrals_safe FROM anon;
GRANT SELECT ON public.registration_referrals_safe TO authenticated;

-- 6. FIX: affiliate_transaction_summary - Own data or admin
DROP VIEW IF EXISTS public.affiliate_transaction_summary;

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
WHERE auth.uid() IS NOT NULL
  AND affiliate_amount IS NOT NULL
  AND affiliate_amount > 0
  AND (
    affiliate_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

REVOKE ALL ON public.affiliate_transaction_summary FROM anon;
GRANT SELECT ON public.affiliate_transaction_summary TO authenticated;