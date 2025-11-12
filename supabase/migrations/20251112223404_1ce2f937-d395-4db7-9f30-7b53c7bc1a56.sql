-- Create notifications table for email history
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Create function to check if user is subscribed to creator
CREATE OR REPLACE FUNCTION public.is_subscribed_to_creator(_user_id uuid, _creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND creator_id = _creator_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Create function to increment user balance
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

-- Create function to handle affiliate bonuses on first subscription
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

-- Create trigger for affiliate bonuses
DROP TRIGGER IF EXISTS handle_affiliate_bonus_trigger ON public.transactions;
CREATE TRIGGER handle_affiliate_bonus_trigger
AFTER INSERT ON public.transactions
FOR EACH ROW
WHEN (NEW.type = 'subscription' AND NEW.status = 'completed')
EXECUTE FUNCTION public.handle_affiliate_bonus();

-- Add daily_room_name to creator_profiles for Daily.co integration
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS daily_room_name text,
ADD COLUMN IF NOT EXISTS daily_room_url text;

-- Add stream_key to rooms for streaming
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS stream_key text,
ADD COLUMN IF NOT EXISTS daily_room_name text;