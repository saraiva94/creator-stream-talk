-- Dynamic revenue split for lives
ALTER TABLE public.lives
  ALTER COLUMN price TYPE numeric USING price::numeric;

ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS creator_percent numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS affiliate_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS platform_percent numeric NOT NULL DEFAULT 30;

UPDATE public.lives
SET
  creator_percent = COALESCE(creator_percent, 60),
  affiliate_percent = COALESCE(affiliate_percent, 10),
  platform_percent = COALESCE(platform_percent, 30)
WHERE creator_percent IS NULL OR affiliate_percent IS NULL OR platform_percent IS NULL;
