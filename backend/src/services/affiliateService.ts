import logger from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { getProfileById, upsertProfileReferralMetadata } from './supabaseService';

export type RegistrationReferralContext = {
  directReferrerId: string | null;
  parentReferrerId: string | null;
  isRootCreator: boolean;
};

const REGISTRATION_PRICE = 5;
const REGISTRATION_PRICE_CENTS = 500;

const fetchCreatorProfileIdByReferralCode = async (referralCode: string) => {
  const trimmed = referralCode.trim();
  const { data: link, error } = await supabase
    .from('referral_links')
    .select('creator_id, code')
    .eq('code', trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load referral link: ${error.message}`);
  }

  if (!link) {
    throw new Error('Invalid referral code');
  }

  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select('user_id')
    .eq('id', link.creator_id as string)
    .maybeSingle();

  if (creatorError) {
    throw new Error(`Failed to resolve creator for referral code: ${creatorError.message}`);
  }

  if (!creator?.user_id) {
    throw new Error('Referral code is missing an associated creator profile');
  }

  return creator.user_id as string;
};

const fetchReferrerProfile = async (profileId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_root_creator, referrer_id, referrer_parent_id')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile referrers: ${error.message}`);
  }

  if (!data) {
    throw new Error('Profile not found');
  }

  return data as {
    id: string;
    is_root_creator: boolean;
    referrer_id: string | null;
    referrer_parent_id: string | null;
  };
};

export const resolveReferralContext = async (
  referralCode?: string | null,
  explicitReferrerId?: string | null,
): Promise<RegistrationReferralContext> => {
  const directReferrerId = explicitReferrerId || (referralCode ? await fetchCreatorProfileIdByReferralCode(referralCode) : null);

  if (!directReferrerId) {
    return { directReferrerId: null, parentReferrerId: null, isRootCreator: true };
  }

  const directProfile = await fetchReferrerProfile(directReferrerId);
  const parentReferrerId = directProfile.is_root_creator ? null : directProfile.referrer_id;

  return {
    directReferrerId,
    parentReferrerId: parentReferrerId ?? null,
    isRootCreator: false,
  };
};

export const applyRegistrationContextToProfile = async (
  profileId: string,
  context: RegistrationReferralContext,
) => {
  const updates = {
    is_root_creator: context.isRootCreator,
    referrer_id: context.directReferrerId,
    referrer_parent_id: context.parentReferrerId,
    referrer_root: context.isRootCreator ? profileId : context.parentReferrerId ?? context.directReferrerId ?? null,
    referrer_direct: context.directReferrerId ?? null,
  } as Record<string, string | boolean | null>;

  await upsertProfileReferralMetadata(profileId, updates);
  return updates;
};

export const markRootCreatorProfile = async (profileId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_root_creator: true,
      referrer_id: null,
      referrer_parent_id: null,
      referrer_root: profileId,
      referrer_direct: null,
    })
    .eq('id', profileId)
    .select('id, is_root_creator')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark root creator: ${error.message}`);
  }

  if (!data) {
    throw new Error('Profile not found while marking root creator');
  }

  logger.info({ event: 'affiliate.mark_root_creator', profileId });
  return data;
};

export const calculateRegistrationSplit = (
  context: RegistrationReferralContext,
): { rootCents: number; directCents: number; platformCents: number; rootRecipientId: string | null } => {
  const baseCents = REGISTRATION_PRICE_CENTS;

  if (!context.directReferrerId) {
    return { rootCents: 0, directCents: 0, platformCents: baseCents, rootRecipientId: null };
  }

  const directCents = 100; // R$1.00
  const parentRecipient = context.parentReferrerId;
  const directIsRoot = !parentRecipient;
  const rootCents = directIsRoot ? 50 : 50; // R$0.50 always reserved for the root
  const rootRecipientId = directIsRoot ? context.directReferrerId : parentRecipient;
  const platformCents = Math.max(0, baseCents - directCents - rootCents);

  return { rootCents, directCents, platformCents, rootRecipientId };
};

export const recordPendingRegistrationReferral = async (
  paymentId: string,
  userId: string,
  context: RegistrationReferralContext,
  opts?: { isFree?: boolean },
) => {
  const { error } = await supabase.from('registration_referrals').upsert(
    {
      payment_id: paymentId,
      user_id: userId,
      referrer_id: context.directReferrerId,
      referrer_parent_id: context.parentReferrerId,
      is_root_creator: context.isRootCreator,
      is_free: Boolean(opts?.isFree),
    },
    { onConflict: 'payment_id' },
  );

  if (error) {
    throw new Error(`Failed to persist registration referral: ${error.message}`);
  }
};

export const fetchPendingRegistrationReferral = async (paymentId: string) => {
  const { data, error } = await supabase
    .from('registration_referrals')
    .select('payment_id, user_id, referrer_id, referrer_parent_id, is_root_creator, is_free')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load pending registration referral: ${error.message}`);
  }

  return data;
};

export const processRegistrationAffiliatePayout = async (
  newUserId: string,
  context: RegistrationReferralContext,
  split: { rootCents: number; directCents: number; rootRecipientId: string | null },
) => {
  const { error } = await supabase.rpc('process_registration_affiliate_payout', {
    p_new_user: newUserId,
    p_root_creator: split.rootRecipientId,
    p_direct_referrer: context.directReferrerId,
    p_amount_root: split.rootCents,
    p_amount_direct: split.directCents,
  });

  if (error) {
    throw new Error(`Failed to process affiliate payout: ${error.message}`);
  }
};

export const getAffiliateStatsForProfile = async (profileId: string) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('affiliate_earnings')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load affiliate earnings: ${profileError.message}`);
  }

  const directCountRes = await supabase
    .from('affiliate_logs')
    .select('id', { count: 'exact', head: true })
    .eq('direct_referrer', profileId);

  if (directCountRes.error) {
    throw new Error(`Failed to aggregate direct referrals: ${directCountRes.error.message}`);
  }

  const indirectRes = await supabase
    .from('affiliate_logs')
    .select('id', { count: 'exact', head: true })
    .eq('root_creator', profileId)
    .neq('direct_referrer', profileId);

  if (indirectRes.error) {
    throw new Error(`Failed to aggregate indirect referrals: ${indirectRes.error.message}`);
  }

  const direct_referrals = directCountRes.count ?? 0;
  const indirect_referrals = indirectRes.count ?? 0;

  return {
    total_affiliate_earnings: profile?.affiliate_earnings ?? 0,
    registrations_referred: direct_referrals + indirect_referrals,
    direct_referrals,
    indirect_referrals,
  };
};

export const getProfileReferrerSnapshot = async (profileId: string) => {
  const profile = await getProfileById(profileId);
  return {
    referrer_root: profile?.referrer_root ?? profile?.referrer_parent_id ?? null,
    referrer_direct: profile?.referrer_direct ?? profile?.referrer_id ?? null,
    affiliate_earnings: profile?.affiliate_earnings ?? 0,
    is_root_creator: profile?.is_root_creator ?? false,
  };
};

export const REGISTRATION_PRICE_VALUE = REGISTRATION_PRICE;
