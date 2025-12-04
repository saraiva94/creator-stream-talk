
-- ============================================
-- TABELAS CRÍTICAS FALTANTES PARA O SISTEMA
-- ============================================

-- 1. WEBHOOK EVENTS (idempotência para webhooks)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert webhook events" ON public.webhook_events
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can select webhook events" ON public.webhook_events
FOR SELECT USING (true);

-- 2. REGISTRATION REFERRALS (rastreio de convites de registro)
CREATE TABLE IF NOT EXISTS public.registration_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  email text,
  referrer_id uuid,
  referrer_parent_id uuid,
  is_root_creator boolean DEFAULT false,
  is_free boolean DEFAULT false,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.registration_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage registration referrals" ON public.registration_referrals
FOR ALL WITH CHECK (true);

CREATE POLICY "Users can view own referrals" ON public.registration_referrals
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = referrer_id);

CREATE INDEX idx_registration_referrals_user ON public.registration_referrals(user_id);
CREATE INDEX idx_registration_referrals_referrer ON public.registration_referrals(referrer_id);
CREATE INDEX idx_registration_referrals_email ON public.registration_referrals(email);

-- 3. AFFILIATE LOGS (histórico de comissões)
CREATE TABLE IF NOT EXISTS public.affiliate_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  new_user uuid,
  direct_referrer uuid,
  root_creator uuid,
  amount_direct integer DEFAULT 0,
  amount_root integer DEFAULT 0,
  amount_platform integer DEFAULT 0,
  event_type text NOT NULL,
  payment_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.affiliate_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert affiliate logs" ON public.affiliate_logs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own affiliate logs" ON public.affiliate_logs
FOR SELECT USING (auth.uid() = direct_referrer OR auth.uid() = root_creator);

CREATE POLICY "Admins can view all affiliate logs" ON public.affiliate_logs
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_affiliate_logs_direct ON public.affiliate_logs(direct_referrer);
CREATE INDEX idx_affiliate_logs_root ON public.affiliate_logs(root_creator);

-- 4. CREDIT PURCHASES (histórico de compras de créditos)
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  credits integer NOT NULL,
  amount_cents integer NOT NULL,
  payment_id text UNIQUE NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage credit purchases" ON public.credit_purchases
FOR ALL WITH CHECK (true);

CREATE POLICY "Users can view own credit purchases" ON public.credit_purchases
FOR SELECT USING (auth.uid() = profile_id);

CREATE INDEX idx_credit_purchases_profile ON public.credit_purchases(profile_id);

-- 5. CREATOR WALLET (carteira do criador em centavos)
CREATE TABLE IF NOT EXISTS public.creator_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid UNIQUE NOT NULL,
  balance_cents integer DEFAULT 0,
  pending_cents integer DEFAULT 0,
  total_earned_cents integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.creator_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own wallet" ON public.creator_wallet
FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage creator wallets" ON public.creator_wallet
FOR ALL WITH CHECK (true);

-- 6. LIVE CONSUMPTION (consumo de créditos por live)
CREATE TABLE IF NOT EXISTS public.live_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_token text,
  seconds_watched integer DEFAULT 0,
  credits_consumed numeric DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  UNIQUE(live_id, user_id, session_token)
);

ALTER TABLE public.live_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consumption" ON public.live_consumption
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Creators can view consumption on their lives" ON public.live_consumption
FOR SELECT USING (
  EXISTS (SELECT 1 FROM lives WHERE lives.id = live_consumption.live_id AND lives.creator_id = auth.uid())
);

CREATE POLICY "System can manage consumption" ON public.live_consumption
FOR ALL WITH CHECK (true);

CREATE INDEX idx_live_consumption_live ON public.live_consumption(live_id);
CREATE INDEX idx_live_consumption_user ON public.live_consumption(user_id);

-- 7. CREATOR EARNINGS (ganhos por live - settlement)
CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  credits_consumed numeric DEFAULT 0,
  gross_amount_cents integer DEFAULT 0,
  creator_amount_cents integer DEFAULT 0,
  platform_amount_cents integer DEFAULT 0,
  status text DEFAULT 'pending',
  settled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own earnings" ON public.creator_earnings
FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "System can manage earnings" ON public.creator_earnings
FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view all earnings" ON public.creator_earnings
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings(creator_id);
CREATE INDEX idx_creator_earnings_live ON public.creator_earnings(live_id);

-- 8. ADICIONAR COLUNAS FALTANTES EM PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referrer_direct uuid,
ADD COLUMN IF NOT EXISTS referrer_root uuid,
ADD COLUMN IF NOT EXISTS referrer_parent_id uuid,
ADD COLUMN IF NOT EXISTS referrer_id uuid,
ADD COLUMN IF NOT EXISTS is_root_creator boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS affiliate_earnings integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 9. ADICIONAR COLUNA user_id EM credits_wallet (se usar user_id ao invés de profile_id)
ALTER TABLE public.credits_wallet 
ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Copiar dados existentes de user_id para profile_id se existirem
UPDATE public.credits_wallet SET profile_id = user_id WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Criar índice para profile_id
CREATE INDEX IF NOT EXISTS idx_credits_wallet_profile ON public.credits_wallet(profile_id);

-- 10. FUNÇÃO RPC: increment_affiliate_earnings
CREATE OR REPLACE FUNCTION public.increment_affiliate_earnings(
  p_profile_id uuid,
  p_amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET affiliate_earnings = COALESCE(affiliate_earnings, 0) + p_amount_cents,
      updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

-- 11. FUNÇÃO RPC: get_or_create_creator_wallet
CREATE OR REPLACE FUNCTION public.get_or_create_creator_wallet(p_creator_id uuid)
RETURNS public.creator_wallet
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 12. FUNÇÃO RPC: increment_creator_wallet
CREATE OR REPLACE FUNCTION public.increment_creator_wallet(
  p_creator_id uuid,
  p_amount_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.creator_wallet (creator_id, balance_cents, total_earned_cents)
  VALUES (p_creator_id, p_amount_cents, p_amount_cents)
  ON CONFLICT (creator_id) DO UPDATE SET
    balance_cents = public.creator_wallet.balance_cents + p_amount_cents,
    total_earned_cents = public.creator_wallet.total_earned_cents + p_amount_cents,
    updated_at = now();
END;
$$;

-- 13. ADICIONAR status EM live_access (se não existir)
ALTER TABLE public.live_access
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 14. Criar constraint unique em live_access se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_access_live_user_unique'
  ) THEN
    ALTER TABLE public.live_access 
    ADD CONSTRAINT live_access_live_user_unique UNIQUE (live_id, user_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
