-- Fix search path for increment_balance function
CREATE OR REPLACE FUNCTION public.increment_balance(_user_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) + _amount
  WHERE id = _user_id;
END;
$$;

-- Fix search path for handle_affiliate_bonus function  
CREATE OR REPLACE FUNCTION public.handle_affiliate_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
BEGIN
  -- Check if this is the first subscription for this user
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = NEW.user_id
    AND type = 'subscription'
    AND created_at < NEW.created_at
  ) THEN
    -- Get the referrer
    SELECT referred_by INTO referrer_id
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    IF referrer_id IS NOT NULL THEN
      -- Give R$1.00 to referrer
      PERFORM public.increment_balance(referrer_id, 1.00);
      
      -- Give R$0.50 to referred user
      PERFORM public.increment_balance(NEW.user_id, 0.50);
      
      -- Update referral record
      UPDATE public.referrals
      SET commission_earned = 1.00,
          status = 'completed'
      WHERE referrer_id = referrer_id
        AND referred_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;