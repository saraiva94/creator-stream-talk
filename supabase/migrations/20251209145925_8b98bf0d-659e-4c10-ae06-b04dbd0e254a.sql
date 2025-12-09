
-- Create platform_revenue table to track platform earnings
CREATE TABLE public.platform_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'registration', 'credits_purchase', 'superchat', 'live_earnings'
  source_id TEXT, -- external payment ID or transaction reference
  amount INTEGER NOT NULL DEFAULT 0, -- amount in centavos
  user_id UUID, -- user who made the payment
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

-- Block public access
CREATE POLICY "Block public access to platform revenue"
ON public.platform_revenue
FOR ALL
USING (false)
WITH CHECK (false);

-- Allow admins to view all revenue
CREATE POLICY "Admins can view all platform revenue"
ON public.platform_revenue
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow system to insert revenue records
CREATE POLICY "System can insert platform revenue"
ON public.platform_revenue
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_platform_revenue_created_at ON public.platform_revenue(created_at DESC);
CREATE INDEX idx_platform_revenue_source_type ON public.platform_revenue(source_type);
