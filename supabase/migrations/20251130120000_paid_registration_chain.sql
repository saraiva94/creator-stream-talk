-- Add status column to profiles for activation gating
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status TEXT
  CONSTRAINT profiles_status_check CHECK (status IN ('pending_payment', 'active'))
  DEFAULT 'active';

-- Ensure constraint exists even if the column was present without it
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending_payment', 'active'));

-- Backfill existing users as active
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;

-- New users should default to pending payment until upgraded
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending_payment';

-- Broaden transaction types to cover registration revenue and referrals
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_type_check CHECK (
  type IN (
    'subscription',
    'superchat_premium',
    'superchat_vip',
    'payout',
    'affiliate',
    'registration_fee',
    'referral_l1',
    'referral_l2',
    'platform_registration'
  )
);

-- Atomic registration payout processor with sliding parent/grandparent logic
CREATE OR REPLACE FUNCTION public.process_registration_payment(
  _new_user_id uuid,
  _parent_id uuid,
  _payment_id text,
  _amount_total numeric DEFAULT 5.00,
  _owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grandparent_id uuid;
  _parent_commission numeric := 0;
  _grand_commission numeric := 0;
  _platform_share numeric := 0;
  _registration_amount numeric := COALESCE(_amount_total, 5.00);
  _existing_registration uuid;
BEGIN
  -- Avoid double processing for the same payment
  SELECT id INTO _existing_registration
  FROM public.transactions
  WHERE external_id = _payment_id AND type = 'registration_fee'
  LIMIT 1;

  IF _existing_registration IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'skipped_existing');
  END IF;

  IF _parent_id IS NOT NULL THEN
    _parent_commission := 1.00;
    SELECT referrer_id INTO _grandparent_id
    FROM public.referrals
    WHERE referred_id = _parent_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF _parent_id = _owner_id THEN
      _grand_commission := 0;
    ELSIF _grandparent_id IS NOT NULL THEN
      _grand_commission := 0.50;
    END IF;
  END IF;

  _platform_share := _registration_amount - _parent_commission - _grand_commission;
  IF _platform_share < 0 THEN
    RAISE EXCEPTION 'Invalid registration split: platform share negative';
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    platform_amount,
    creator_amount,
    affiliate_amount,
    status,
    external_id,
    metadata
  )
  VALUES (
    _new_user_id,
    'registration_fee',
    _registration_amount,
    _platform_share,
    0,
    0,
    'completed',
    _payment_id,
    jsonb_build_object('paymentId', _payment_id)
  );

  IF _parent_commission > 0 AND _parent_id IS NOT NULL THEN
    INSERT INTO public.transactions (
      user_id,
      affiliate_id,
      type,
      amount,
      affiliate_amount,
      platform_amount,
      status,
      external_id,
      metadata
    )
    VALUES (
      _new_user_id,
      _parent_id,
      'referral_l1',
      _parent_commission,
      _parent_commission,
      0,
      'completed',
      concat(_payment_id, '-L1'),
      jsonb_build_object('paymentId', _payment_id, 'level', 1)
    )
    ON CONFLICT DO NOTHING;

    PERFORM public.increment_balance(_parent_id, _parent_commission);
  END IF;

  IF _grand_commission > 0 AND _grandparent_id IS NOT NULL THEN
    INSERT INTO public.transactions (
      user_id,
      affiliate_id,
      type,
      amount,
      affiliate_amount,
      platform_amount,
      status,
      external_id,
      metadata
    )
    VALUES (
      _new_user_id,
      _grandparent_id,
      'referral_l2',
      _grand_commission,
      _grand_commission,
      0,
      'completed',
      concat(_payment_id, '-L2'),
      jsonb_build_object('paymentId', _payment_id, 'level', 2)
    )
    ON CONFLICT DO NOTHING;

    PERFORM public.increment_balance(_grandparent_id, _grand_commission);
  END IF;

  -- Record platform share explicitly for accounting
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    platform_amount,
    status,
    external_id,
    metadata
  )
  VALUES (
    _new_user_id,
    'platform_registration',
    _platform_share,
    _platform_share,
    'completed',
    concat(_payment_id, '-PLATFORM'),
    jsonb_build_object('paymentId', _payment_id)
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET status = 'active'
  WHERE id = _new_user_id;

  RETURN jsonb_build_object(
    'status', 'processed',
    'parent_id', _parent_id,
    'grandparent_id', _grandparent_id,
    'parent_commission', _parent_commission,
    'grandparent_commission', _grand_commission,
    'platform_share', _platform_share
  );
END;
$$;
