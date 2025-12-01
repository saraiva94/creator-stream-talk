import { supabase } from '../lib/supabaseClient';
import logger from '../lib/logger';

export interface RegistrationReferralContext {
  email: string;
  directId: string | null;
  rootId: string | null;
  inviteId?: string | null;
  isRootCreator: boolean;
  paymentId?: string | null;
  referralCode?: string | null;
  isFree?: boolean;
}

export const REGISTRATION_PRICE_VALUE = 5;
const DIRECT_COMMISSION_VALUE = 1;
const ROOT_COMMISSION_VALUE = 0.5;

const toCents = (value: number) => Math.round(value * 100);

const clean = (value?: string | null) => (value ? value.trim() : null);

type ReferralProfile = {
  id?: string;
  referrer_root?: string | null;
  referrer_parent_id?: string | null;
  referrer_id?: string | null;
  is_root_creator?: boolean | null;
  referral_code?: string | null;
};

const resolveProfileByReferralCode = async (referralCode: string): Promise<ReferralProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, referrer_root, referrer_direct, referrer_parent_id, referrer_id, is_root_creator, referral_code')
    .eq('referral_code', referralCode)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve referral code: ${error.message}`);
  }

  return data;
};

const resolveProfileFromReferralLink = async (referralCode: string): Promise<ReferralProfile | null> => {
  const { data, error } = await supabase
    .from('referral_links')
    .select('creator_id, creators!inner(user_id)')
    .eq('code', referralCode)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve referral link: ${error.message}`);
  }

  const creator = (data as { creators?: { user_id?: string } | null } | null)?.creators;
  const profileId = creator?.user_id as string | undefined;

  if (!profileId) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, referrer_root, referrer_direct, referrer_parent_id, referrer_id, is_root_creator')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load profile for referral link: ${profileError.message}`);
  }

  return profile;
};

const resolveRootFromProfile = (profile?: ReferralProfile | null) => {
  if (!profile) return null;
  return (
    (profile.referrer_root as string | null | undefined) ??
    (profile.referrer_parent_id as string | null | undefined) ??
    (profile.referrer_id as string | null | undefined) ??
    null
  );
};

const fetchRegistrationReferralForProfile = async (profileId: string) => {
  const { data, error } = await supabase
    .from('registration_referrals')
    .select('payment_id, referrer_id, referrer_parent_id, is_root_creator')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load registration referral: ${error.message}`);
  }

  return data;
};

export const resolveReferralContext = async (
  referralCode?: string | null,
  explicitDirectId?: string | null,
  email?: string,
): Promise<RegistrationReferralContext> => {
  const normalizedCode = clean(referralCode);
  let directId: string | null = explicitDirectId ?? null;
  let rootId: string | null = null;
  let isRootCreator = false;

  if (!directId && normalizedCode) {
    const profile = (await resolveProfileByReferralCode(normalizedCode)) ?? (await resolveProfileFromReferralLink(normalizedCode));
    directId = (profile?.id as string | undefined) ?? null;
    rootId = resolveRootFromProfile(profile);
    isRootCreator = Boolean(profile?.is_root_creator) || !rootId;
  }

  if (directId && !rootId) {
    const previousReferral = await fetchRegistrationReferralForProfile(directId);
    rootId = previousReferral?.referrer_parent_id ?? previousReferral?.referrer_id ?? null;
    isRootCreator = Boolean(previousReferral?.is_root_creator) || !rootId;
  }

  if (!directId) {
    isRootCreator = true;
  }

  return {
    email: email ?? '',
    directId,
    rootId,
    inviteId: normalizedCode ?? explicitDirectId ?? null,
    isRootCreator,
    referralCode: normalizedCode ?? null,
  };
};

const ensureReferralCode = async (profileId: string) => {
  const { data, error } = await supabase.from('profiles').select('referral_code').eq('id', profileId).maybeSingle();

  if (error) {
    throw new Error(`Failed to read referral code: ${error.message}`);
  }

  let referralCode = data?.referral_code as string | null;
  if (referralCode) return referralCode;

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
  return referralCode;
};

export const applyRegistrationContextToProfile = async (
  profileId: string,
  context: RegistrationReferralContext,
) => {
  const updates: Record<string, unknown> = {
    referrer_direct: context.directId ?? null,
    referrer_root: context.rootId ?? null,
    is_root_creator: Boolean(context.isRootCreator),
    referrer_id: context.directId ?? null,
    referrer_parent_id: context.rootId ?? null,
  };

  if (context.isRootCreator) {
    updates.referral_code = await ensureReferralCode(profileId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select('id, referrer_direct, referrer_root, is_root_creator')
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
  const { data: existing, error: existingError } = await supabase
    .from('registration_referrals')
    .select('payment_id')
    .eq('user_id', profileId)
    .eq('referrer_id', context.directId ?? null)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to verify registration referral: ${existingError.message}`);
  }

  if (existing) {
    if (existing.payment_id === paymentId) {
      return existing;
    }
    const error = new Error('Invite already used for this account');
    (error as { status?: number }).status = 409;
    throw error;
  }

  const payload = {
    payment_id: paymentId,
    user_id: profileId,
    referrer_id: context.directId ?? null,
    referrer_parent_id: context.rootId ?? null,
    is_root_creator: Boolean(context.isRootCreator),
    is_free: Boolean(options?.isFree),
  };

  const { error } = await supabase.from('registration_referrals').upsert(payload, { onConflict: 'payment_id' });

  if (error) {
    throw new Error(`Failed to record registration referral: ${error.message}`);
  }

  return payload;
};

export const markRootCreatorProfile = async (profileId: string) => {
  const referralCode = await ensureReferralCode(profileId);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_root_creator: true,
      referrer_root: null,
      referrer_direct: null,
      referrer_id: null,
      referrer_parent_id: null,
      referral_code: referralCode,
    })
    .eq('id', profileId)
    .select('id, referral_code, is_root_creator')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark root creator profile: ${error.message}`);
  }

  return data;
};

const logAffiliateRegistration = async ({
  newUserId,
  directId,
  rootId,
  directAmountCents,
  rootAmountCents,
}: {
  newUserId: string;
  directId: string | null;
  rootId: string | null;
  directAmountCents: number;
  rootAmountCents: number;
}) => {
  const { error } = await supabase.from('affiliate_logs').insert({
    new_user: newUserId,
    direct_referrer: directId,
    root_creator: rootId,
    amount_direct: directAmountCents,
    amount_root: rootAmountCents,
    event_type: 'REGISTRATION',
    amount_platform: Math.max(0, toCents(REGISTRATION_PRICE_VALUE) - directAmountCents - rootAmountCents),
  } as Record<string, unknown>);

  if (error) {
    logger.warn({ event: 'affiliate.log.write_failed', error: error.message });
  }
};

const applyAffiliateEarnings = async ({
  newUserId,
  directId,
  rootId,
  directAmountCents,
  rootAmountCents,
}: {
  newUserId: string;
  directId: string | null;
  rootId: string | null;
  directAmountCents: number;
  rootAmountCents: number;
}) => {
  const { error } = await supabase.rpc('process_registration_affiliate_payout', {
    p_new_user: newUserId,
    p_root_creator: rootId,
    p_direct_referrer: directId,
    p_amount_root: rootAmountCents,
    p_amount_direct: directAmountCents,
  });

  if (error) {
    throw new Error(`Failed to apply affiliate earnings: ${error.message}`);
  }
};

export const finalizeRegistrationReferral = async ({
  paymentId,
  userId,
  email,
  directId,
  rootId,
  inviteId,
  isRootCreator,
}: {
  paymentId: string;
  userId: string;
  email?: string | null;
  directId?: string | null;
  rootId?: string | null;
  inviteId?: string | null;
  isRootCreator?: boolean;
}) => {
  const normalizedDirect = directId ?? null;
  const normalizedRoot = rootId && rootId !== normalizedDirect ? rootId : null;
  const directAmountCents = normalizedDirect ? toCents(DIRECT_COMMISSION_VALUE) : 0;
  const rootAmountCents = normalizedRoot ? toCents(ROOT_COMMISSION_VALUE) : 0;

  const context: RegistrationReferralContext = {
    email: email ?? '',
    directId: normalizedDirect,
    rootId: normalizedRoot,
    inviteId: inviteId ?? null,
    isRootCreator: Boolean(isRootCreator) || !normalizedRoot,
    paymentId,
  };

  await applyRegistrationContextToProfile(userId, context);
  await recordPendingRegistrationReferral(paymentId, userId, context, { isFree: false });
  await applyAffiliateEarnings({
    newUserId: userId,
    directId: normalizedDirect,
    rootId: normalizedRoot,
    directAmountCents,
    rootAmountCents,
  });
  await logAffiliateRegistration({
    newUserId: userId,
    directId: normalizedDirect,
    rootId: normalizedRoot,
    directAmountCents,
    rootAmountCents,
  });

  logger.info({
    event: 'registration.payout.distributed',
    userId,
    paymentId,
    directId: normalizedDirect,
    rootId: normalizedRoot,
    amount_direct_cents: directAmountCents,
    amount_root_cents: rootAmountCents,
    amount_platform_cents: Math.max(0, toCents(REGISTRATION_PRICE_VALUE) - directAmountCents - rootAmountCents),
  });

  return context;
};
