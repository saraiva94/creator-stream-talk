-- Add columns to registration_referrals to store pending registration data
ALTER TABLE public.registration_referrals 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS registration_data JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_registration_referrals_status_payment ON public.registration_referrals(status, payment_id);