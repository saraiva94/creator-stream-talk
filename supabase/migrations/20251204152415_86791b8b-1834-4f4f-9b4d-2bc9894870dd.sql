
-- Fix function search_path for existing functions without it
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_affiliate_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = NEW.user_id
    AND type = 'subscription'
    AND created_at < NEW.created_at
  ) THEN
    SELECT referred_by INTO referrer_id
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    IF referrer_id IS NOT NULL THEN
      PERFORM public.increment_balance(referrer_id, 1.00);
      PERFORM public.increment_balance(NEW.user_id, 0.50);
      
      UPDATE public.referrals
      SET commission_earned = 1.00,
          status = 'completed'
      WHERE referrals.referrer_id = referrer_id
        AND referred_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
