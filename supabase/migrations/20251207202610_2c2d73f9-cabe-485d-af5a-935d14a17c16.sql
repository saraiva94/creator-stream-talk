-- Add blocked_reason column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS blocked_reason TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.blocked_reason IS 'Reason provided by admin when blocking the user';