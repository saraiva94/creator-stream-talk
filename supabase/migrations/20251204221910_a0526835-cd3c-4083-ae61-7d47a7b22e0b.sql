-- Drop the existing check constraint and add a new one with all required types
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
CHECK (type = ANY (ARRAY[
  'subscription'::text, 
  'superchat_premium'::text, 
  'superchat_vip'::text, 
  'payout'::text,
  'credits_purchase'::text,
  'registration'::text,
  'live_access'::text,
  'superchat'::text
]));