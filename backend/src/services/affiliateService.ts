import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../types/supabaseTypes';

type ReferralRow = Tables<'referrals'>;

export type RegistrationReferralContext = {
  directReferrerId: string | null;
  parentReferrerId: string | null;
  referralCode?: string | null;
  isRootCreator: boolean;
};

export const REGISTRATION_PRICE_VALUE = 5;

const OWNER_USER_ID = process.env.PLATFORM_OWNER_USER_ID;
const toCurrency = (cents: number) => Number((cents / 100).toFixed(2));
const normalizeReferralCode = (code?: string | null) => code?.trim() || null;

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

const ensureProfileReferralCode = async (profileId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load referral code: ${error.message}`);
  }

  let referralCode = data?.referral_code as string | null;

  if (!referralCode) {
    const candidate = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ referral_code: candidate })
      .eq('id', profileId)
      .select('referral_code')
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to create referral code: ${updateError.message}`);
    }

    referralCode = updated?.referral_code ?? candidate;
  }

  return referralCode;
};

const findParentReferrerId = async (referrerId: string | null) => {
  if (!referrerId) return null;

  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', referrerId)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load parent referrer: ${error.message}`);
  }

  return (data?.referrer_id as string | null) ?? null;
};

const resolveDirectReferrer = async (referralCode: string | null, explicitReferrerId?: string | null) => {
  if (explicitReferrerId) {
    return explicitReferrerId;
  }

  if (!referralCode) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', referralCode)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve referral code: ${error.message}`);
  }

  return (data?.id as string | null) ?? null;
};

export const resolveReferralContext = async (
  referralCode?: string | null,
  referrerId?: string | null,
): Promise<RegistrationReferralContext> => {
  const normalizedCode = normalizeReferralCode(referralCode);
  const directReferrerId = await resolveDirectReferrer(normalizedCode, referrerId);
  const parentReferrerId = await findParentReferrerId(directReferrerId);
  const isRootCreator = !directReferrerId || !parentReferrerId;

  return {
    directReferrerId,
    parentReferrerId,
    referralCode: normalizedCode,
    isRootCreator,
  };
};

export const applyRegistrationContextToProfile = async (
  profileId: string,
  context: RegistrationReferralContext,
) => {
  const updates: Record<string, unknown> = {
    referred_by: context.directReferrerId ?? null,
  };

  if (context.isRootCreator) {
    updates.referral_code = await ensureProfileReferralCode(profileId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select('id, referred_by, referral_code')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to apply registration context: ${error.message}`);
  }

  return data;
};

export const recordPendingRegistrationReferral = async (
  paymentId: string,
  profileId: string,
  context: RegistrationReferralContext,
  options?: { isFree?: boolean },
) => {
  const referrerId = context.directReferrerId ?? profileId;
  const referralCode =
    normalizeReferralCode(context.referralCode) ||
    (context.directReferrerId ? await ensureProfileReferralCode(referrerId) : 'DIRECT');

  const { data, error } = await supabase
    .from('referrals')
    .upsert(
      {
        id: paymentId || undefined,
        referrer_id: referrerId,
        referred_id: profileId,
        referral_code: referralCode,
        status: options?.isFree ? 'approved' : 'pending_payment',
      },
      { onConflict: 'referred_id' },
    )
    .select('id, referrer_id, referred_id, status')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to record registration referral: ${error.message}`);
  }

  return data as ReferralRow | null;
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

export const markRootCreatorProfile = async (userId: string) => {
  const referralCode = await ensureProfileReferralCode(userId);

  const { data, error } = await supabase
    .from('profiles')
    .update({ referred_by: null, referral_code: referralCode })
    .eq('id', userId)
    .select('id, referral_code, referred_by')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark root creator profile: ${error.message}`);
  }

  return data;
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
    _amount_total: Number.isFinite(amountCents)
      ? toCurrency(amountCents as number)
      : REGISTRATION_PRICE_VALUE,
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
