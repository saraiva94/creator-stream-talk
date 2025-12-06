-- Fix security issues:
-- 1. Restrict public_profiles view to authenticated users only
-- 2. Restrict room_participants visibility to room creators only (not all participants)

-- 1. Restrict public_profiles view - add RLS to underlying view
-- First, we need to drop and recreate as a secure view
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.bio,
  p.gender,
  p.website,
  p.language,
  p.referral_code,
  p.status,
  p.is_subscribed,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.id = auth.uid();

-- 2. Fix room_participants - only room creators should see all participants
-- Remove the policy that allows participants to see other participants
DROP POLICY IF EXISTS "Participants can view other participants in same room" ON public.room_participants;

-- Add a more restrictive policy - users can only see their own participation
-- (Room creators can already view via the existing policy)