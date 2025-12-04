-- Create lives table (main table for live streaming sessions)
CREATE TABLE public.lives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  price NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  is_active BOOLEAN DEFAULT false,
  room_name TEXT,
  creator_percent NUMERIC DEFAULT 80,
  affiliate_percent NUMERIC DEFAULT 10,
  platform_percent NUMERIC DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT lives_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.creator_profiles(id) ON DELETE CASCADE
);

-- Create creators table (maps to creator_profiles for backend compatibility)
CREATE TABLE public.creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT creators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create payments table for tracking payment records
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  live_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create commissions table for tracking affiliate commissions
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  payment_id UUID,
  commission_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create creator_balance table for tracking creator earnings
CREATE TABLE public.creator_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL UNIQUE,
  balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add approved_for_live column to creator_profiles
ALTER TABLE public.creator_profiles 
ADD COLUMN IF NOT EXISTS approved_for_live BOOLEAN DEFAULT false;

-- Enable RLS on all new tables
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_balance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lives
CREATE POLICY "Lives are viewable by everyone" ON public.lives FOR SELECT USING (true);
CREATE POLICY "Creators can insert own lives" ON public.lives FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own lives" ON public.lives FOR UPDATE USING (auth.uid() = creator_id);

-- RLS Policies for creators
CREATE POLICY "Creators are viewable by everyone" ON public.creators FOR SELECT USING (true);
CREATE POLICY "Users can create own creator profile" ON public.creators FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own creator profile" ON public.creators FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert payments" ON public.payments FOR INSERT WITH CHECK (true);

-- RLS Policies for commissions
CREATE POLICY "Creators can view own commissions" ON public.commissions FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "System can insert commissions" ON public.commissions FOR INSERT WITH CHECK (true);

-- RLS Policies for creator_balance
CREATE POLICY "Creators can view own balance" ON public.creator_balance FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "System can manage balances" ON public.creator_balance FOR ALL WITH CHECK (true);