-- Fix 5 security vulnerabilities identified in QA

-- 1. Fix creators table: restrict SELECT to owner and admins only
DROP POLICY IF EXISTS "Creators are viewable by everyone" ON public.creators;

CREATE POLICY "Creators can view own profile"
ON public.creators
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all creators"
ON public.creators
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix creator_bank_accounts: ensure ONLY owner and admin access (drop and recreate cleaner)
DROP POLICY IF EXISTS "Block public access to bank accounts" ON public.creator_bank_accounts;
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON public.creator_bank_accounts;
DROP POLICY IF EXISTS "Creators can insert own bank account" ON public.creator_bank_accounts;
DROP POLICY IF EXISTS "Creators can update own bank account" ON public.creator_bank_accounts;
DROP POLICY IF EXISTS "Creators can view own bank account" ON public.creator_bank_accounts;

-- Recreate with PERMISSIVE policies (not RESTRICTIVE which can cause gaps)
CREATE POLICY "Creators can view own bank account"
ON public.creator_bank_accounts
FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Admins can view all bank accounts"
ON public.creator_bank_accounts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Creators can insert own bank account"
ON public.creator_bank_accounts
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own bank account"
ON public.creator_bank_accounts
FOR UPDATE
USING (auth.uid() = creator_id);

-- 3. Fix transactions table: affiliates should only see their commission, not full breakdown
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions as buyer"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Creators can view transactions where they earned"
ON public.transactions
FOR SELECT
USING (auth.uid() = creator_id);

-- Create a separate view for affiliate earnings without exposing full transaction details
CREATE OR REPLACE VIEW public.affiliate_transaction_summary AS
SELECT 
  id,
  affiliate_id,
  affiliate_amount,
  created_at,
  status
FROM public.transactions
WHERE affiliate_id = auth.uid();

-- 4. Fix email_queue: restrict to only status fields, not content
DROP POLICY IF EXISTS "Users can view their own emails" ON public.email_queue;

-- Create a view that only exposes safe email metadata
CREATE OR REPLACE VIEW public.email_queue_summary WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  email_type,
  status,
  sent_at,
  created_at
FROM public.email_queue
WHERE auth.uid() = user_id;

-- Remove direct SELECT on email_queue for users
CREATE POLICY "Users can view own email summary only"
ON public.email_queue
FOR SELECT
USING (false); -- Block direct access, use view instead

CREATE POLICY "System can manage emails"
ON public.email_queue
FOR ALL
USING (false)
WITH CHECK (true);

-- 5. Fix live_consumption: hide session_token from SELECT queries
-- Create a view without session_token
CREATE OR REPLACE VIEW public.live_consumption_safe WITH (security_invoker = true) AS
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
WHERE auth.uid() = user_id 
   OR EXISTS (
     SELECT 1 FROM public.lives 
     WHERE lives.id = live_consumption.live_id 
     AND lives.creator_id = auth.uid()
   );