import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../types/supabaseTypes';

type ReferralRow = Tables<'referrals'>;
type TransactionsRow = Tables<'transactions'>;

const LEVEL1_PAYOUT_CENTS = 100;
const LEVEL2_PAYOUT_CENTS = 50;

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

const hasExistingAffiliateTransaction = async (externalId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('external_id', externalId)
    .eq('type', 'affiliate')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check affiliate transaction: ${error.message}`);
  }

  return Boolean(data);
};

const insertAffiliateTransaction = async ({
  referrerId,
  newUserId,
  paymentId,
  level,
  amountCents,
}: {
  referrerId: string;
  newUserId: string;
  paymentId: string;
  level: number;
  amountCents: number;
}) => {
  const externalId = `${paymentId}-L${level}`;

  const exists = await hasExistingAffiliateTransaction(externalId);
  if (exists) {
    return false;
  }

  const amount = toCurrency(amountCents);

  const { error } = await supabase.from('transactions').insert({
    user_id: newUserId,
    affiliate_id: referrerId,
    amount,
    affiliate_amount: amount,
    platform_amount: 0,
    creator_amount: 0,
    status: 'completed',
    type: 'affiliate',
    external_id: externalId,
    metadata: { level, paymentId },
  } satisfies Partial<TransactionsRow>);

  if (error) {
    throw new Error(`Failed to insert affiliate transaction: ${error.message}`);
  }

  return true;
};

const creditProfileBalance = async (profileId: string, amountCents: number) => {
  if (amountCents <= 0) return;
  const amount = toCurrency(amountCents);
  const { error } = await supabase.rpc('increment_balance', { _user_id: profileId, _amount: amount });
  if (error) {
    throw new Error(`Failed to credit affiliate balance: ${error.message}`);
  }
};

export const registerAffiliatePayoutForSignup = async ({
  newUserId,
  paymentId,
  amountCents,
}: {
  newUserId: string;
  paymentId: string;
  amountCents?: number;
}) => {
  const chain = await getReferralChainForUser(newUserId);

  const level1UserId = chain.level1?.userId;
  const level2UserId = chain.level2?.userId;

  const payouts: { userId: string; amountCents: number; level: number }[] = [];

  if (level1UserId) payouts.push({ userId: level1UserId, amountCents: LEVEL1_PAYOUT_CENTS, level: 1 });
  if (level2UserId) payouts.push({ userId: level2UserId, amountCents: LEVEL2_PAYOUT_CENTS, level: 2 });

  for (const payout of payouts) {
    const inserted = await insertAffiliateTransaction({
      referrerId: payout.userId,
      newUserId,
      paymentId,
      level: payout.level,
      amountCents: payout.amountCents,
    });
    if (inserted) {
      await creditProfileBalance(payout.userId, payout.amountCents);
    }
  }

  console.log(
    JSON.stringify({
      event: 'affiliate.signup.payout',
      paymentId,
      newUserId,
      level1UserId,
      level2UserId,
      level1PayoutCents: level1UserId ? LEVEL1_PAYOUT_CENTS : 0,
      level2PayoutCents: level2UserId ? LEVEL2_PAYOUT_CENTS : 0,
      amountCents,
    }),
  );

  return {
    newUserId,
    level1PayoutCents: level1UserId ? LEVEL1_PAYOUT_CENTS : 0,
    level2PayoutCents: level2UserId ? LEVEL2_PAYOUT_CENTS : 0,
    level1UserId,
    level2UserId,
  };
};
