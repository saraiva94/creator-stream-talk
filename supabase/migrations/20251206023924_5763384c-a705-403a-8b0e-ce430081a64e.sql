-- Fix Security Definer Views - recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;
DROP VIEW IF EXISTS public.live_consumption_safe;
DROP VIEW IF EXISTS public.email_queue_summary;
DROP VIEW IF EXISTS public.registration_referrals_safe;
DROP VIEW IF EXISTS public.affiliate_transaction_summary;

-- Recreate all views with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.public_profiles 
WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  avatar_url,
  bio,
  is_subscribed,
  referral_code,
  created_at
FROM public.profiles;

CREATE VIEW public.live_consumption_safe 
WITH (security_invoker = true) AS
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

CREATE VIEW public.email_queue_summary 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  sent_at,
  created_at,
  email_type,
  status
FROM public.email_queue;

CREATE VIEW public.registration_referrals_safe 
WITH (security_invoker = true) AS
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
FROM public.registration_referrals;

CREATE VIEW public.affiliate_transaction_summary 
WITH (security_invoker = true) AS
SELECT 
  id,
  affiliate_id,
  affiliate_amount,
  created_at,
  status
FROM public.transactions
WHERE affiliate_id IS NOT NULL;

-- Fix rooms table to hide stream_key from non-owners
-- Create a secure view for public room access
CREATE OR REPLACE VIEW public.rooms_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  creator_id,
  is_active,
  viewer_count,
  created_at,
  ended_at,
  title,
  daily_room_name
  -- stream_key is intentionally excluded
FROM public.rooms;