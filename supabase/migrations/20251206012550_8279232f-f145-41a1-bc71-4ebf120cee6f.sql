-- Block anonymous/public access to sensitive financial tables

-- Creator bank accounts (extremely sensitive)
CREATE POLICY "Block public access to bank accounts" 
ON public.creator_bank_accounts 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Credit purchases
CREATE POLICY "Block public access to credit purchases" 
ON public.credit_purchases 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Transactions
CREATE POLICY "Block public access to transactions" 
ON public.transactions 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Creator wallet
CREATE POLICY "Block public access to creator wallet" 
ON public.creator_wallet 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Credits wallet
CREATE POLICY "Block public access to credits wallet" 
ON public.credits_wallet 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Profiles (sensitive financial data)
CREATE POLICY "Block public access to profiles" 
ON public.profiles 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Payout requests
CREATE POLICY "Block public access to payout requests" 
ON public.payout_requests 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Creator earnings
CREATE POLICY "Block public access to creator earnings" 
ON public.creator_earnings 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Affiliate logs
CREATE POLICY "Block public access to affiliate logs" 
ON public.affiliate_logs 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);

-- Registration referrals (contains emails)
CREATE POLICY "Block public access to registration referrals" 
ON public.registration_referrals 
FOR ALL TO anon 
USING (false) 
WITH CHECK (false);