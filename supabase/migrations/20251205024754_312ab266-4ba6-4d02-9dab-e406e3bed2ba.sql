
-- Remove old constraint and add new one with pix_withdrawal type
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('registration', 'credits_purchase', 'superchat', 'live_consumption', 'pix_withdrawal', 'affiliate_commission', 'payout'));
