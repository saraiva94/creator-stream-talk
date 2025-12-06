-- Fix remaining security issues

-- 1. Add explicit block policy for creator_bank_accounts
CREATE POLICY "Block all public access to bank accounts"
ON public.creator_bank_accounts
FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Fix registration_referrals - create view without email column
CREATE OR REPLACE VIEW public.registration_referrals_safe WITH (security_invoker = true) AS
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
WHERE auth.uid() = user_id OR auth.uid() = referrer_id;

-- Drop direct access policy and restrict to view only
DROP POLICY IF EXISTS "Users can view own referrals" ON public.registration_referrals;

CREATE POLICY "Block direct access to registration referrals"
ON public.registration_referrals
FOR SELECT
USING (false);