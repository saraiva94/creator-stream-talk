-- Add language preference to profiles (if not exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Update financial settings to 80/20 split (creator/platform)
UPDATE public.financial_settings
SET 
  creator_percentage = 80.00,
  platform_percentage = 20.00,
  affiliate_percentage = 0.00
WHERE id IS NOT NULL;