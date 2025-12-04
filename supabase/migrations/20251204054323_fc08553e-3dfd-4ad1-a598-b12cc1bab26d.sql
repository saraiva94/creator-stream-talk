-- Create credits_wallet table if not exists
CREATE TABLE IF NOT EXISTS public.credits_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credits_wallet ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own wallet" ON public.credits_wallet;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.credits_wallet;
DROP POLICY IF EXISTS "System can insert wallets" ON public.credits_wallet;

-- Create policies
CREATE POLICY "Users can view own wallet" ON public.credits_wallet
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON public.credits_wallet
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets" ON public.credits_wallet
  FOR INSERT WITH CHECK (true);

-- Create live_access table if not exists
CREATE TABLE IF NOT EXISTS public.live_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(live_id, user_id)
);

-- Enable RLS
ALTER TABLE public.live_access ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own live access" ON public.live_access;
DROP POLICY IF EXISTS "System can grant live access" ON public.live_access;

-- Create policies
CREATE POLICY "Users can view own live access" ON public.live_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can grant live access" ON public.live_access
  FOR INSERT WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credits_wallet_user_id ON public.credits_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_live_access_user_live ON public.live_access(user_id, live_id);