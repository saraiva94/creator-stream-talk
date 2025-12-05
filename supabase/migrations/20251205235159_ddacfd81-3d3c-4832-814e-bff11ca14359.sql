-- Fix 1: creator_bank_accounts - Add explicit deny for public access
-- The table already has owner/admin policies but scan detects potential exposure
-- Ensure RLS is properly enforced with explicit authenticated-only policies
DROP POLICY IF EXISTS "Creators can view own bank account" ON public.creator_bank_accounts;
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON public.creator_bank_accounts;

CREATE POLICY "Creators can view own bank account"
ON public.creator_bank_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "Admins can view all bank accounts"
ON public.creator_bank_accounts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: email_queue - Restrict to owner only
DROP POLICY IF EXISTS "Users can view their own emails" ON public.email_queue;

CREATE POLICY "Users can view their own emails"
ON public.email_queue
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: credit_purchases - Restrict to owner only
DROP POLICY IF EXISTS "Users can view own credit purchases" ON public.credit_purchases;

CREATE POLICY "Users can view own credit purchases"
ON public.credit_purchases
FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);

-- Fix 4: Ensure profiles has no public access gap
-- Drop any potential public policies and recreate authenticated-only
DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;