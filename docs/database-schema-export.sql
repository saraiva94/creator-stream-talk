-- ============================================================
-- STREAM STAR - DATABASE SCHEMA EXPORT
-- Exported: 2026-01-21
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'creator', 'viewer');

-- ============================================================
-- TABLES
-- ============================================================

-- Table: affiliate_logs
CREATE TABLE public.affiliate_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_user UUID,
  direct_referrer UUID,
  root_creator UUID,
  amount_direct INTEGER DEFAULT 0,
  amount_root INTEGER DEFAULT 0,
  amount_platform INTEGER DEFAULT 0,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: banned_users
CREATE TABLE public.banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  banned_by UUID NOT NULL,
  reason TEXT,
  is_permanent BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Table: chat_settings
CREATE TABLE public.chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE,
  slow_mode_enabled BOOLEAN DEFAULT false,
  slow_mode_duration INTEGER DEFAULT 5,
  subscribers_only BOOLEAN DEFAULT false,
  banned_words TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: commissions
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  payment_id UUID,
  commission_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: content_reports
CREATE TABLE public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  live_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: creator_balance
CREATE TABLE public.creator_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE,
  balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: creator_bank_accounts
CREATE TABLE public.creator_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE,
  bank_name TEXT,
  account_number TEXT,
  document_number TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: creator_earnings
CREATE TABLE public.creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  credits_consumed NUMERIC DEFAULT 0,
  gross_amount_cents INTEGER DEFAULT 0,
  creator_amount_cents INTEGER DEFAULT 0,
  platform_amount_cents INTEGER DEFAULT 0,
  affiliate_amount_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: creator_profiles
CREATE TABLE public.creator_profiles (
  id UUID PRIMARY KEY,
  is_streaming BOOLEAN DEFAULT false,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_for_live BOOLEAN DEFAULT false,
  daily_room_name TEXT,
  daily_room_url TEXT,
  display_name TEXT NOT NULL,
  bio TEXT,
  tags TEXT[] DEFAULT '{}'
);

-- Table: creator_wallet
CREATE TABLE public.creator_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE,
  balance_cents INTEGER DEFAULT 0,
  pending_cents INTEGER DEFAULT 0,
  total_earned_cents INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: creators
CREATE TABLE public.creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  display_name TEXT,
  bio TEXT
);

-- Table: credit_purchases
CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  credits INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: credits_wallet
CREATE TABLE public.credits_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  profile_id UUID
);

-- Table: direct_messages
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  metadata JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: email_queue
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: financial_settings
CREATE TABLE public.financial_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: homepage_settings
CREATE TABLE public.homepage_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: live_access
CREATE TABLE public.live_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL,
  user_id UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending'
);

-- Table: live_consumption
CREATE TABLE public.live_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_token TEXT,
  seconds_watched INTEGER DEFAULT 0,
  credits_consumed NUMERIC DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE
);

-- Table: lives
CREATE TABLE public.lives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  price NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  creator_percent NUMERIC DEFAULT 80,
  affiliate_percent NUMERIC DEFAULT 10,
  platform_percent NUMERIC DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  chat_room_id UUID,
  host_joined_at TIMESTAMP WITH TIME ZONE,
  host_last_heartbeat TIMESTAMP WITH TIME ZONE,
  actual_viewer_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  room_name TEXT,
  thumbnail_url TEXT,
  webrtc_room_name TEXT
);

-- Table: messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  file_url TEXT,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  live_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: payout_requests
CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bank_account_id UUID,
  admin_notes TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  psp_transaction_id TEXT,
  psp_response JSONB,
  failure_reason TEXT,
  source_type TEXT DEFAULT 'creator',
  idempotency_key TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: platform_revenue
CREATE TABLE public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  referral_code TEXT,
  referred_by UUID,
  referrer_direct UUID,
  referrer_root UUID,
  referrer_id UUID,
  referrer_parent_id UUID,
  is_root_creator BOOLEAN DEFAULT false,
  balance NUMERIC DEFAULT 0,
  affiliate_earnings INTEGER DEFAULT 0,
  is_subscribed BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  bio TEXT,
  gender TEXT,
  status TEXT DEFAULT 'active',
  blocked_reason TEXT,
  instagram_handle TEXT,
  twitter_handle TEXT,
  tiktok_handle TEXT,
  facebook_handle TEXT,
  kwai_handle TEXT,
  youtube_handle TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: promo_video_views
CREATE TABLE public.promo_video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL,
  user_id UUID,
  session_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  watch_duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: promotional_videos
CREATE TABLE public.promotional_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: referrals
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  commission_earned NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: registration_referrals
CREATE TABLE public.registration_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  email TEXT,
  referrer_id UUID,
  referrer_parent_id UUID,
  is_root_creator BOOLEAN DEFAULT false,
  is_free BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Table: room_participants
CREATE TABLE public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  stream_key TEXT,
  daily_room_name TEXT,
  is_active BOOLEAN DEFAULT true,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Table: subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Table: superchats
CREATE TABLE public.superchats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  message TEXT NOT NULL,
  amount INTEGER NOT NULL,
  tier TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  displayed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Table: transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  creator_id UUID,
  affiliate_id UUID,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  platform_amount NUMERIC,
  creator_amount NUMERIC,
  affiliate_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  external_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: user_followed_tags
CREATE TABLE public.user_followed_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: wallet_transactions
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  wallet_type TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: webhook_events
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: webhook_logs
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'mercadopago',
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  payload JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_affiliate_logs_direct ON public.affiliate_logs USING btree (direct_referrer);
CREATE INDEX idx_affiliate_logs_root ON public.affiliate_logs USING btree (root_creator);
CREATE INDEX idx_credit_purchases_profile ON public.credit_purchases USING btree (profile_id);
CREATE INDEX idx_credits_wallet_profile ON public.credits_wallet USING btree (profile_id);
CREATE INDEX idx_credits_wallet_user_id ON public.credits_wallet USING btree (user_id);
CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings USING btree (creator_id);
CREATE INDEX idx_creator_earnings_live ON public.creator_earnings USING btree (live_id);
CREATE INDEX idx_dm_conversation ON public.direct_messages USING btree (sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_dm_receiver ON public.direct_messages USING btree (receiver_id, created_at DESC);
CREATE INDEX idx_dm_sender ON public.direct_messages USING btree (sender_id, created_at DESC);
CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status);
CREATE INDEX idx_email_queue_user ON public.email_queue USING btree (user_id);
CREATE INDEX idx_live_access_live_id ON public.live_access USING btree (live_id);
CREATE INDEX idx_live_access_user_id ON public.live_access USING btree (user_id);
CREATE INDEX idx_live_consumption_live_id ON public.live_consumption USING btree (live_id);
CREATE INDEX idx_live_consumption_user_id ON public.live_consumption USING btree (user_id);
CREATE INDEX idx_lives_creator_id ON public.lives USING btree (creator_id);
CREATE INDEX idx_lives_is_active ON public.lives USING btree (is_active);
CREATE INDEX idx_lives_status ON public.lives USING btree (status);
CREATE INDEX idx_messages_room_id ON public.messages USING btree (room_id);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_payout_requests_creator ON public.payout_requests USING btree (creator_id);
CREATE INDEX idx_payout_requests_status ON public.payout_requests USING btree (status);
CREATE INDEX idx_platform_revenue_created_at ON public.platform_revenue USING btree (created_at);
CREATE INDEX idx_platform_revenue_source_type ON public.platform_revenue USING btree (source_type);
CREATE INDEX idx_profiles_referral_code ON public.profiles USING btree (referral_code);
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE INDEX idx_promo_video_views_video_id ON public.promo_video_views USING btree (video_id);
CREATE INDEX idx_registration_referrals_payment ON public.registration_referrals USING btree (payment_id);
CREATE INDEX idx_registration_referrals_referrer ON public.registration_referrals USING btree (referrer_id);
CREATE INDEX idx_registration_referrals_status ON public.registration_referrals USING btree (status);
CREATE INDEX idx_room_participants_room_id ON public.room_participants USING btree (room_id);
CREATE INDEX idx_rooms_creator_id ON public.rooms USING btree (creator_id);
CREATE INDEX idx_subscriptions_creator ON public.subscriptions USING btree (creator_id);
CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);
CREATE INDEX idx_superchats_room_id ON public.superchats USING btree (room_id);
CREATE INDEX idx_transactions_user ON public.transactions USING btree (user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);
CREATE INDEX idx_wallet_transactions_wallet ON public.wallet_transactions USING btree (wallet_id);
CREATE INDEX idx_webhook_events_key ON public.webhook_events USING btree (idempotency_key);
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs USING btree (status);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_creator_wallet_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approved_for_live = true AND (OLD.approved_for_live IS NULL OR OLD.approved_for_live = false) THEN
    INSERT INTO public.creator_wallet (creator_id, balance_cents, pending_cents, total_earned_cents)
    VALUES (NEW.id, 0, 0, 0)
    ON CONFLICT (creator_id) DO NOTHING;
    
    RAISE LOG '[ensure_creator_wallet] Created wallet for creator %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_creator_wallet(p_creator_id uuid)
RETURNS creator_wallet
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wallet_record public.creator_wallet;
BEGIN
  SELECT * INTO wallet_record FROM public.creator_wallet WHERE creator_id = p_creator_id;
  
  IF wallet_record IS NULL THEN
    INSERT INTO public.creator_wallet (creator_id, balance_cents, pending_cents, total_earned_cents)
    VALUES (p_creator_id, 0, 0, 0)
    RETURNING * INTO wallet_record;
  END IF;
  
  RETURN wallet_record;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_affiliate_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.increment_affiliate_earnings(p_profile_id uuid, p_amount_cents integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET affiliate_earnings = COALESCE(affiliate_earnings, 0) + p_amount_cents,
      updated_at = now()
  WHERE id = p_profile_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_balance(_user_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) + _amount
  WHERE id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_creator_wallet(p_creator_id uuid, p_amount_cents integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.creator_wallet (creator_id, balance_cents, total_earned_cents)
  VALUES (p_creator_id, p_amount_cents, p_amount_cents)
  ON CONFLICT (creator_id) DO UPDATE SET
    balance_cents = public.creator_wallet.balance_cents + p_amount_cents,
    total_earned_cents = public.creator_wallet.total_earned_cents + p_amount_cents,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_subscribed_to_creator(_user_id uuid, _creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND creator_id = _creator_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
$function$;

CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id FROM public.profiles WHERE referral_code = UPPER(p_code) LIMIT 1;
$function$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_chat_settings_updated_at 
  BEFORE UPDATE ON chat_settings 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_creator_bank_accounts_updated_at 
  BEFORE UPDATE ON creator_bank_accounts 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER on_creator_approved 
  AFTER UPDATE ON creator_profiles 
  FOR EACH ROW EXECUTE FUNCTION ensure_creator_wallet_on_approval();

CREATE TRIGGER on_creator_created_approved 
  AFTER INSERT ON creator_profiles 
  FOR EACH ROW WHEN (NEW.approved_for_live = true) 
  EXECUTE FUNCTION ensure_creator_wallet_on_approval();

CREATE TRIGGER generate_profile_referral_code 
  BEFORE INSERT OR UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

CREATE TRIGGER profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_promotional_videos_updated_at 
  BEFORE UPDATE ON promotional_videos 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_affiliate_bonus_trigger 
  AFTER INSERT ON transactions 
  FOR EACH ROW WHEN (NEW.type = 'subscription' AND NEW.status = 'completed') 
  EXECUTE FUNCTION handle_affiliate_bonus();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.affiliate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superchats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_followed_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- ========================
-- affiliate_logs policies
-- ========================
CREATE POLICY "Admins can view all affiliate logs" ON public.affiliate_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to affiliate logs" ON public.affiliate_logs
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "System can insert affiliate logs" ON public.affiliate_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own affiliate logs" ON public.affiliate_logs
  FOR SELECT USING ((auth.uid() = direct_referrer) OR (auth.uid() = root_creator));

-- ========================
-- banned_users policies
-- ========================
CREATE POLICY "Bans viewable by room creators" ON public.banned_users
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = banned_users.room_id AND rooms.creator_id = auth.uid())
  );

CREATE POLICY "Room creators can manage bans" ON public.banned_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = banned_users.room_id AND rooms.creator_id = auth.uid())
  );

-- ========================
-- chat_settings policies
-- ========================
CREATE POLICY "Anyone can view chat settings" ON public.chat_settings
  FOR SELECT USING (true);

CREATE POLICY "Room creators can manage chat settings" ON public.chat_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = chat_settings.room_id AND rooms.creator_id = auth.uid())
  );

-- ========================
-- commissions policies
-- ========================
CREATE POLICY "Creators can view own commissions" ON public.commissions
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can insert commissions" ON public.commissions
  FOR INSERT WITH CHECK (true);

-- ========================
-- content_reports policies
-- ========================
CREATE POLICY "Admins can update reports" ON public.content_reports
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all reports" ON public.content_reports
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create reports" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ========================
-- creator_balance policies
-- ========================
CREATE POLICY "Creators can view own balance" ON public.creator_balance
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage balances" ON public.creator_balance
  FOR ALL WITH CHECK (true);

-- ========================
-- creator_bank_accounts policies
-- ========================
CREATE POLICY "Admins can view all bank accounts" ON public.creator_bank_accounts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block all public access to bank accounts" ON public.creator_bank_accounts
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Creators can insert own bank account" ON public.creator_bank_accounts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own bank account" ON public.creator_bank_accounts
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can view own bank account" ON public.creator_bank_accounts
  FOR SELECT USING (auth.uid() = creator_id);

-- ========================
-- creator_earnings policies
-- ========================
CREATE POLICY "Admins can view all earnings" ON public.creator_earnings
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to creator earnings" ON public.creator_earnings
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Creators can view own earnings" ON public.creator_earnings
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage earnings" ON public.creator_earnings
  FOR ALL WITH CHECK (true);

-- ========================
-- creator_profiles policies
-- ========================
CREATE POLICY "Admins can update creator profiles" ON public.creator_profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all creator profiles" ON public.creator_profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator profiles viewable by everyone" ON public.creator_profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Creators can insert own profile" ON public.creator_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Creators can update own profile" ON public.creator_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ========================
-- creator_wallet policies
-- ========================
CREATE POLICY "Block public access to creator wallet" ON public.creator_wallet
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Creators can view own wallet" ON public.creator_wallet
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage creator wallets" ON public.creator_wallet
  FOR ALL WITH CHECK (true);

-- ========================
-- creators policies
-- ========================
CREATE POLICY "Admins can view all creators" ON public.creators
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators can view own profile" ON public.creators
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own creator profile" ON public.creators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own creator profile" ON public.creators
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================
-- credit_purchases policies
-- ========================
CREATE POLICY "Block public access to credit purchases" ON public.credit_purchases
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "System can manage credit purchases" ON public.credit_purchases
  FOR ALL WITH CHECK (true);

CREATE POLICY "Users can view own credit purchases" ON public.credit_purchases
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);

-- ========================
-- credits_wallet policies
-- ========================
CREATE POLICY "Block public access to credits wallet" ON public.credits_wallet
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "System can insert wallets" ON public.credits_wallet
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own wallet" ON public.credits_wallet
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wallet" ON public.credits_wallet
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- direct_messages policies
-- ========================
CREATE POLICY "Receivers can mark messages as read" ON public.direct_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Senders can update own messages" ON public.direct_messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete own messages" ON public.direct_messages
  FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "Users can send messages" ON public.direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view own messages" ON public.direct_messages
  FOR SELECT USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

-- ========================
-- email_queue policies
-- ========================
CREATE POLICY "Admins can view all email queue" ON public.email_queue
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to email queue" ON public.email_queue
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "System can insert email queue" ON public.email_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update email queue" ON public.email_queue
  FOR UPDATE USING (true);

-- ========================
-- financial_settings policies
-- ========================
CREATE POLICY "Only admins can update financial settings" ON public.financial_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can view financial settings" ON public.financial_settings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================
-- homepage_settings policies
-- ========================
CREATE POLICY "Everyone can view homepage settings" ON public.homepage_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Only admins can update homepage settings" ON public.homepage_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ========================
-- live_access policies
-- ========================
CREATE POLICY "System can grant live access" ON public.live_access
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own live access" ON public.live_access
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- live_consumption policies
-- ========================
CREATE POLICY "Creators can view consumption on their lives" ON public.live_consumption
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lives WHERE lives.id = live_consumption.live_id AND lives.creator_id = auth.uid())
  );

CREATE POLICY "System can manage consumption" ON public.live_consumption
  FOR ALL WITH CHECK (true);

CREATE POLICY "Users can view own consumption" ON public.live_consumption
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- lives policies
-- ========================
CREATE POLICY "Creators can insert own lives" ON public.lives
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own lives" ON public.lives
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Lives are viewable by everyone" ON public.lives
  FOR SELECT TO anon, authenticated USING (true);

-- ========================
-- messages policies
-- ========================
CREATE POLICY "Anonymous can view messages in active rooms" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = messages.room_id AND rooms.is_active = true)
  );

CREATE POLICY "Authenticated users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Messages viewable by room participants" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = messages.room_id AND (rooms.creator_id = auth.uid() OR rooms.is_active = true))
  );

-- ========================
-- notifications policies
-- ========================
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- payments policies
-- ========================
CREATE POLICY "System can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- payout_requests policies
-- ========================
CREATE POLICY "Admins can update payout requests" ON public.payout_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all payout requests" ON public.payout_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to payout requests" ON public.payout_requests
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Creators can create payout requests" ON public.payout_requests
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can view own payout requests" ON public.payout_requests
  FOR SELECT USING (auth.uid() = creator_id);

-- ========================
-- platform_revenue policies
-- ========================
CREATE POLICY "Admins can view all platform revenue" ON public.platform_revenue
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to platform revenue" ON public.platform_revenue
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "System can insert platform revenue" ON public.platform_revenue
  FOR INSERT WITH CHECK (true);

-- ========================
-- profiles policies
-- ========================
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view basic profile info" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ========================
-- promo_video_views policies
-- ========================
CREATE POLICY "Admins can view all promo analytics" ON public.promo_video_views
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can record promo views" ON public.promo_video_views
  FOR INSERT WITH CHECK (true);

-- ========================
-- promotional_videos policies
-- ========================
CREATE POLICY "Admins can manage promotional videos" ON public.promotional_videos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view promotional videos" ON public.promotional_videos
  FOR SELECT USING (true);

-- ========================
-- referrals policies
-- ========================
CREATE POLICY "Only system can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING ((auth.uid() = referrer_id) OR (auth.uid() = referred_id));

-- ========================
-- registration_referrals policies
-- ========================
CREATE POLICY "Block direct access to registration referrals" ON public.registration_referrals
  FOR SELECT USING (false);

CREATE POLICY "Block public access to registration referrals" ON public.registration_referrals
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "System can manage registration referrals" ON public.registration_referrals
  FOR ALL WITH CHECK (true);

-- ========================
-- room_participants policies
-- ========================
CREATE POLICY "Room creators can view participants" ON public.room_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id AND rooms.creator_id = auth.uid())
  );

CREATE POLICY "Users can insert themselves as participants" ON public.room_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove themselves from rooms" ON public.room_participants
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own participation" ON public.room_participants
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- rooms policies
-- ========================
CREATE POLICY "Anyone can view active rooms" ON public.rooms
  FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can insert own rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own rooms" ON public.rooms
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Only creators see own rooms" ON public.rooms
  FOR SELECT USING (auth.uid() = creator_id);

-- ========================
-- subscriptions policies
-- ========================
CREATE POLICY "Creators can view their subscribers" ON public.subscriptions
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can create subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- superchats policies
-- ========================
CREATE POLICY "Anonymous can view superchats in active rooms" ON public.superchats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = superchats.room_id AND rooms.is_active = true)
  );

CREATE POLICY "Creators can update superchats in their rooms" ON public.superchats
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Superchats viewable by participants" ON public.superchats
  FOR SELECT USING (
    (auth.uid() = user_id) OR (auth.uid() = creator_id) OR 
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = superchats.room_id AND r.is_active = true)
  );

CREATE POLICY "System can insert superchats" ON public.superchats
  FOR INSERT WITH CHECK (true);

-- ========================
-- transactions policies
-- ========================
CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to transactions" ON public.transactions
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Creators can view transactions where they earned" ON public.transactions
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own transactions as buyer" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- user_followed_tags policies
-- ========================
CREATE POLICY "Users can follow tags" ON public.user_followed_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow tags" ON public.user_followed_tags
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own followed tags" ON public.user_followed_tags
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- user_roles policies
-- ========================
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- ========================
-- wallet_transactions policies
-- ========================
CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block public access to wallet transactions" ON public.wallet_transactions
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "System can insert wallet transactions" ON public.wallet_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own affiliate wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (wallet_type = 'affiliate' AND wallet_id = auth.uid());

CREATE POLICY "Users can view own creator wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (wallet_type = 'creator' AND wallet_id = auth.uid());

-- ========================
-- webhook_events policies
-- ========================
CREATE POLICY "System can insert webhook events" ON public.webhook_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can select webhook events" ON public.webhook_events
  FOR SELECT USING (true);

-- ========================
-- webhook_logs policies
-- ========================
CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );

-- ============================================================
-- VIEWS (Safe Views for Public Access)
-- ============================================================

CREATE OR REPLACE VIEW public.lives_public AS
SELECT 
  id, creator_id, price, is_active, created_at, ended_at,
  title, description, status, room_name, thumbnail_url
FROM public.lives;

CREATE OR REPLACE VIEW public.rooms_public AS
SELECT 
  id, creator_id, is_active, viewer_count, created_at, ended_at,
  daily_room_name, title
FROM public.rooms;

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id, username, avatar_url, bio, referral_code
FROM public.profiles;

-- ============================================================
-- END OF SCHEMA EXPORT
-- ============================================================
