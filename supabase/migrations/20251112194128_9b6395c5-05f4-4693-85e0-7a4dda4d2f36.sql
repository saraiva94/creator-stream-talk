-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'creator', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Financial settings table
CREATE TABLE public.financial_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_price DECIMAL(10,2) NOT NULL DEFAULT 29.90,
  platform_percentage DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  creator_percentage DECIMAL(5,2) NOT NULL DEFAULT 60.00,
  affiliate_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view financial settings"
  ON public.financial_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update financial settings"
  ON public.financial_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default financial settings
INSERT INTO public.financial_settings (subscription_price, platform_percentage, creator_percentage, affiliate_percentage)
VALUES (29.90, 30.00, 60.00, 10.00);

-- Creator bank accounts table
CREATE TABLE public.creator_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings')),
  account_number TEXT NOT NULL,
  routing_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  document_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(creator_id)
);

ALTER TABLE public.creator_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own bank account"
  ON public.creator_bank_accounts FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can insert own bank account"
  ON public.creator_bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own bank account"
  ON public.creator_bank_accounts FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can view all bank accounts"
  ON public.creator_bank_accounts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'superchat_premium', 'superchat_vip', 'payout')),
  amount DECIMAL(10,2) NOT NULL,
  platform_amount DECIMAL(10,2),
  creator_amount DECIMAL(10,2),
  affiliate_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT,
  external_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = creator_id OR auth.uid() = affiliate_id);

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_creator_id ON public.transactions(creator_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- Payout requests table
CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  bank_account_id UUID REFERENCES public.creator_bank_accounts(id),
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own payout requests"
  ON public.payout_requests FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can create payout requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admins can view all payout requests"
  ON public.payout_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payout requests"
  ON public.payout_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  commission_earned DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(referred_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Anyone can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN referred_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN balance DECIMAL(10,2) DEFAULT 0;

-- Chat settings table
CREATE TABLE public.chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slow_mode_enabled BOOLEAN DEFAULT false,
  slow_mode_duration INTEGER DEFAULT 5,
  subscribers_only BOOLEAN DEFAULT false,
  banned_words TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat settings"
  ON public.chat_settings FOR SELECT
  USING (true);

CREATE POLICY "Room creators can manage chat settings"
  ON public.chat_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = chat_settings.room_id
      AND rooms.creator_id = auth.uid()
    )
  );

-- Banned users table
CREATE TABLE public.banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  banned_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  is_permanent BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bans in their rooms"
  ON public.banned_users FOR SELECT
  USING (true);

CREATE POLICY "Room creators can manage bans"
  ON public.banned_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = banned_users.room_id
      AND rooms.creator_id = auth.uid()
    )
  );

-- Subscriptions history table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Creators can view their subscribers"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = creator_id);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_creator_id ON public.subscriptions(creator_id);

-- Trigger for updated_at
CREATE TRIGGER update_creator_bank_accounts_updated_at
  BEFORE UPDATE ON public.creator_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_chat_settings_updated_at
  BEFORE UPDATE ON public.chat_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to auto-assign viewer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Generate referral code function
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_profile_referral_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();