-- =====================================================
-- DEFINITIVE SECURITY FIX: profiles and email_queue_summary
-- =====================================================

-- 1. Add RLS policy to profiles table to allow authenticated users to view basic public data
-- This is required for user search, creator profiles, etc.
CREATE POLICY "Authenticated users can view public profile data"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Recreate email_queue_summary with stricter access (service_role only)
DROP VIEW IF EXISTS public.email_queue_summary CASCADE;

-- Recreate view - only accessible via service_role (backend)
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

-- Revoke ALL access from everyone
REVOKE ALL ON public.email_queue_summary FROM PUBLIC;
REVOKE ALL ON public.email_queue_summary FROM anon;
REVOKE ALL ON public.email_queue_summary FROM authenticated;

-- Only service_role can access (backend operations only)
GRANT SELECT ON public.email_queue_summary TO service_role;