-- Fix Security Definer View warning by ensuring all views use security_invoker properly
-- and don't have security definer issues

-- Drop and recreate affiliate_transaction_summary with security_invoker
DROP VIEW IF EXISTS public.affiliate_transaction_summary;

CREATE VIEW public.affiliate_transaction_summary WITH (security_invoker = true) AS
SELECT 
  id,
  affiliate_id,
  affiliate_amount,
  created_at,
  status
FROM public.transactions
WHERE affiliate_id = auth.uid();