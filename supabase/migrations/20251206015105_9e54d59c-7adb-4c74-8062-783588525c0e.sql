-- Fix: Allow public to validate affiliate codes by querying public_profiles view
-- The validateAffiliateCode function needs to check referral_code even for unauthenticated users

-- Create a function to validate affiliate codes that works for unauthenticated users
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE referral_code = UPPER(p_code) LIMIT 1;
$$;