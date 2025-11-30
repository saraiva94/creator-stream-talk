import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../types/supabaseTypes';

type ReferralRow = Tables<'referrals'>;

const OWNER_USER_ID = process.env.PLATFORM_OWNER_USER_ID;
const toCurrency = (cents: number) => Number((cents / 100).toFixed(2));

const fetchReferral = async (referredId: string): Promise<ReferralRow | null> => {
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referrer_id, referred_id, status')
    .eq('referred_id', referredId)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load referral for user: ${error.message}`);
  }

  return (data as ReferralRow | null) ?? null;
};

export const getReferralChainForUser = async (userId: string) => {
  const level1Referral = await fetchReferral(userId);
  const level1UserId = level1Referral?.referrer_id ?? undefined;

  let level2UserId: string | undefined;
  if (level1UserId) {
    const level2Referral = await fetchReferral(level1UserId);
    level2UserId = level2Referral?.referrer_id ?? undefined;
  }

  return {
    userId,
    level1: level1UserId ? { userId: level1UserId } : undefined,
    level2: level2UserId ? { userId: level2UserId } : undefined,
  };
};

export const registerAffiliatePayoutForSignup = async ({
  newUserId,
  paymentId,
  amountCents,
  parentId,
}: {
  newUserId: string;
  paymentId: string;
  amountCents?: number;
  parentId?: string | null;
}) => {
  const chain = await getReferralChainForUser(newUserId);
  const parentUserId = parentId ?? chain.level1?.userId ?? null;

  const { data, error } = await supabase.rpc('process_registration_payment', {
    _new_user_id: newUserId,
    _parent_id: parentUserId,
    _payment_id: paymentId,
    _amount_total: Number.isFinite(amountCents) ? toCurrency(amountCents as number) : 5,
    _owner_id: OWNER_USER_ID ?? null,
  });

  if (error) {
    throw new Error(`Failed to process registration payout: ${error.message}`);
  }

  console.log(
    JSON.stringify({
      event: 'affiliate.signup.registration',
      paymentId,
      newUserId,
      parentUserId,
      ownerUserId: OWNER_USER_ID,
      result: data,
    }),
  );

  return data;
};
