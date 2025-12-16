
-- Function to automatically create creator_wallet when creator is approved
CREATE OR REPLACE FUNCTION public.ensure_creator_wallet_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if approved_for_live changed to true
  IF NEW.approved_for_live = true AND (OLD.approved_for_live IS NULL OR OLD.approved_for_live = false) THEN
    -- Create creator_wallet if it doesn't exist
    INSERT INTO public.creator_wallet (creator_id, balance_cents, pending_cents, total_earned_cents)
    VALUES (NEW.id, 0, 0, 0)
    ON CONFLICT (creator_id) DO NOTHING;
    
    RAISE LOG '[ensure_creator_wallet] Created wallet for creator %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on creator_profiles
DROP TRIGGER IF EXISTS on_creator_approved ON public.creator_profiles;

CREATE TRIGGER on_creator_approved
  AFTER UPDATE ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_creator_wallet_on_approval();

-- Also handle INSERT in case creator is created already approved
DROP TRIGGER IF EXISTS on_creator_created_approved ON public.creator_profiles;

CREATE TRIGGER on_creator_created_approved
  AFTER INSERT ON public.creator_profiles
  FOR EACH ROW
  WHEN (NEW.approved_for_live = true)
  EXECUTE FUNCTION public.ensure_creator_wallet_on_approval();

-- Backfill: Create wallets for all existing approved creators who don't have one
INSERT INTO public.creator_wallet (creator_id, balance_cents, pending_cents, total_earned_cents)
SELECT cp.id, 0, 0, 0
FROM public.creator_profiles cp
WHERE cp.approved_for_live = true
AND NOT EXISTS (
  SELECT 1 FROM public.creator_wallet cw WHERE cw.creator_id = cp.id
);
