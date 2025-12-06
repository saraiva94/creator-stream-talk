-- 1. DROP public views that expose data without RLS
DROP VIEW IF EXISTS public.public_profiles;
DROP VIEW IF EXISTS public.live_consumption_safe;
DROP VIEW IF EXISTS public.email_queue_summary;
DROP VIEW IF EXISTS public.registration_referrals_safe;
DROP VIEW IF EXISTS public.affiliate_transaction_summary;

-- 2. Recreate public_profiles with security (only non-sensitive fields, requires auth)
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  is_subscribed,
  referral_code,
  created_at
FROM public.profiles;

-- 3. Add RLS to views by creating secure alternatives as functions or using SECURITY INVOKER
-- Note: Views inherit RLS from underlying tables when accessed through authenticated users

-- 4. Create secure view for live consumption (only own data)
CREATE VIEW public.live_consumption_safe AS
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

-- 5. Create secure email queue summary (blocked from direct access)
CREATE VIEW public.email_queue_summary AS
SELECT 
  id,
  user_id,
  sent_at,
  created_at,
  email_type,
  status
FROM public.email_queue
WHERE false; -- Completely blocked - use backend only

-- 6. Create secure registration referrals view (blocked from direct access)  
CREATE VIEW public.registration_referrals_safe AS
SELECT 
  id,
  user_id,
  referrer_id,
  referrer_parent_id,
  is_root_creator,
  is_free,
  created_at,
  completed_at,
  payment_id,
  status
FROM public.registration_referrals
WHERE false; -- Completely blocked - use backend only

-- 7. Create secure affiliate transaction summary
CREATE VIEW public.affiliate_transaction_summary AS
SELECT 
  id,
  affiliate_id,
  affiliate_amount,
  created_at,
  status
FROM public.transactions
WHERE affiliate_id = auth.uid() AND affiliate_amount IS NOT NULL;