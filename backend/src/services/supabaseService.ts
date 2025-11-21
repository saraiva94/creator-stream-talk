import logger from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

export type LiveLifecycleStatus =
  | 'scheduled'
  | 'waiting_for_host'
  | 'live'
  | 'inactive'
  | 'ending'
  | 'ended';

export type LiveRecord = {
  id: string;
  price: number | null;
  creator_percent: number | null;
  affiliate_percent: number | null;
  platform_percent: number | null;
  creator_id: string;
  creator_profile_id: string;
  status?: LiveLifecycleStatus | null;
  is_active?: boolean | null;
  title?: string | null;
  description?: string | null;
  room_name?: string | null;
  currency?: string | null;
  created_at?: string | null;
};

export type LiveSummary = {
  id: string;
  creator_id: string;
  title: string | null;
  description: string | null;
  price: number | null;
  currency?: string | null;
  status: LiveLifecycleStatus | null;
  is_active: boolean | null;
  room_name: string | null;
  creator_percent: number | null;
  affiliate_percent: number | null;
  platform_percent: number | null;
  created_at: string | null;
  ended_at: string | null;
};

const LIVE_STATUS_SET = new Set<LiveLifecycleStatus>([
  'scheduled',
  'waiting_for_host',
  'live',
  'inactive',
  'ending',
  'ended',
]);

const LIVE_SUMMARY_FIELDS =
  'id, creator_id, title, description, price, currency, status, is_active, room_name, creator_percent, affiliate_percent, platform_percent, created_at, ended_at';

const AFFILIATE_THRESHOLD = 0.51; // anything <= $0.50 is considered affiliate revenue

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const normalizeNumber = (value: number | string | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeStatus = (status: string | null): LiveLifecycleStatus | null => {
  if (!status) return null;
  const normalized = status.toLowerCase() as LiveLifecycleStatus;
  return LIVE_STATUS_SET.has(normalized) ? normalized : null;
};

export const getLiveWithCreator = async (liveId: string) => {
  const { data, error } = await supabase
    .from('lives')
    .select(
      'id, price, currency, created_at, creator_id, title, description, creator_percent, affiliate_percent, platform_percent, status, is_active, room_name',
    )
    .eq('id', liveId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch live: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select('id, user_id')
    .eq('id', data.creator_id)
    .maybeSingle();

  if (creatorError) {
    throw new Error(`Failed to load creator: ${creatorError.message}`);
  }

  if (!creator) {
    return null;
  }

  return {
    id: data.id,
    price: data.price as number | null,
    creator_percent: data.creator_percent as number | null,
    affiliate_percent: data.affiliate_percent as number | null,
    platform_percent: data.platform_percent as number | null,
    creator_id: data.creator_id as string,
    creator_profile_id: creator.user_id,
    status: normalizeStatus(data.status as string | null),
    is_active: (data.is_active as boolean | null) ?? null,
    title: data.title,
    description: data.description,
    room_name: data.room_name,
  } as LiveRecord;
};

export const updateLiveLifecycleStatus = async (liveId: string, status: LiveLifecycleStatus) => {
  if (!LIVE_STATUS_SET.has(status)) {
    throw new Error(`Invalid live status: ${status}`);
  }

  const updates: Record<string, unknown> = { status };

  if (status === 'scheduled' || status === 'ended') {
    updates.is_active = false;
  } else {
    updates.is_active = true;
  }

  if (status === 'ended') {
    updates.ended_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('lives')
    .update(updates)
    .eq('id', liveId)
    .select('id, status, is_active')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update live status: ${error.message}`);
  }

  return data;
};

export const listPublicLives = async (): Promise<LiveSummary[]> => {
  const publicStatuses: LiveLifecycleStatus[] = ['scheduled', 'waiting_for_host', 'live', 'inactive', 'ending'];
  const { data, error } = await supabase
    .from('lives')
    .select(LIVE_SUMMARY_FIELDS)
    .in('status', publicStatuses)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load public lives: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    creator_id: row.creator_id,
    title: row.title,
    description: row.description,
    price: row.price,
    status: normalizeStatus(row.status as string | null),
    is_active: row.is_active,
    room_name: row.room_name,
    creator_percent: row.creator_percent,
    affiliate_percent: row.affiliate_percent,
    platform_percent: row.platform_percent,
    created_at: row.created_at,
    ended_at: row.ended_at,
  })) as LiveSummary[];
};

export const listLivesForCreator = async (creatorId: string): Promise<LiveSummary[]> => {
  const { data, error } = await supabase
    .from('lives')
    .select(LIVE_SUMMARY_FIELDS)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load creator lives: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    creator_id: row.creator_id,
    title: row.title,
    description: row.description,
    price: row.price,
    status: normalizeStatus(row.status as string | null),
    is_active: row.is_active,
    room_name: row.room_name,
    creator_percent: row.creator_percent,
    affiliate_percent: row.affiliate_percent,
    platform_percent: row.platform_percent,
    created_at: row.created_at,
    ended_at: row.ended_at,
  })) as LiveSummary[];
};

export const recordPayment = async ({
  paymentId,
  userId,
  liveId,
  amount,
  status,
}: {
  paymentId?: string;
  userId: string;
  liveId: string;
  amount: number;
  status: string;
}) => {
  const payload = {
    user_id: userId,
    live_id: liveId,
    amount,
    status,
  };

  if (paymentId) {
    const { data, error } = await supabase
      .from('payments')
      .update(payload)
      .eq('id', paymentId)
      .select('id, user_id, live_id, amount, status')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    if (!data) {
      throw new Error('Payment not found for update');
    }

    return data;
  }

  const { data, error } = await supabase
    .from('payments')
    .insert(payload)
    .select('id, user_id, live_id, amount, status')
    .single();

  if (error) {
    throw new Error(`Failed to insert payment: ${error.message}`);
  }

  return data;
};

export const recordCreditPurchase = async ({
  userId,
  creditsAdded,
  paymentId,
}: {
  userId: string;
  creditsAdded: number;
  paymentId?: string;
}) => {
  const { data, error } = await supabase
    .from('credit_purchases')
    .insert({
      user_id: userId,
      credits_added: creditsAdded,
      payment_id: paymentId ?? null,
    })
    .select('id, user_id, credits_added, payment_id, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to record credit purchase: ${error.message}`);
  }

  return data;
};

export const grantLiveAccess = async (userId: string, liveId: string) => {
  const existing = await supabase
    .from('live_access')
    .select('id, user_id, live_id, granted_at')
    .eq('user_id', userId)
    .eq('live_id', liveId)
    .maybeSingle();

  if (existing.data) {
    return existing.data;
  }

  if (existing.error) {
    throw new Error(`Failed to verify existing access: ${existing.error.message}`);
  }

  const { data, error } = await supabase
    .from('live_access')
    .insert({ user_id: userId, live_id: liveId, granted_at: new Date().toISOString() })
    .select('id, user_id, live_id, granted_at')
    .single();

  if (error) {
    throw new Error(`Failed to grant access: ${error.message}`);
  }

  return data;
};

export const saveLiveRoomName = async (liveId: string, roomName: string) => {
  const { data, error } = await supabase
    .from('lives')
    .update({ room_name: roomName })
    .eq('id', liveId)
    .select('id, room_name')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update live room name: ${error.message}`);
  }

  if (!data) {
    throw new Error('Live not found while saving room name');
  }

  return data.room_name as string;
};

export const hasLiveAccess = async (userId: string, liveId: string) => {
  const { data, error } = await supabase
    .from('live_access')
    .select('id')
    .eq('user_id', userId)
    .eq('live_id', liveId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check access: ${error.message}`);
  }

  return Boolean(data);
};

export const getLiveAccessWithCredits = async (userId: string, liveId: string) => {
  const [{ data: accessRow, error: accessError }, { data: profileRow, error: profileError }] = await Promise.all([
    supabase
      .from('live_access')
      .select('id, credits_consumed')
      .eq('user_id', userId)
      .eq('live_id', liveId)
      .maybeSingle(),
    supabase.from('profiles').select('id, credit_balance').eq('id', userId).maybeSingle(),
  ]);

  if (accessError) {
    throw new Error(`Failed to load live access: ${accessError.message}`);
  }
  if (profileError) {
    throw new Error(`Failed to load profile credits: ${profileError.message}`);
  }

  const creditBalance = profileRow?.credit_balance ?? 0;
  const hasAccess = Boolean(accessRow);
  const creditsConsumed = accessRow?.credits_consumed ?? 0;
  const isBlockedForCredits = hasAccess && creditBalance <= 0;

  return {
    hasAccess,
    creditBalance,
    creditsConsumed,
    isBlockedForCredits,
  };
};

export const getLiveAnalyticsSnapshot = async (liveId: string) => {
  const [{ data: liveRow, error: liveError }, { data: accessRows, error: accessError }] = await Promise.all([
    supabase
      .from('lives')
      .select('id, creator_id, created_at, status, price, creator_percent')
      .eq('id', liveId)
      .maybeSingle(),
    supabase
      .from('live_access')
      .select('user_id, credits_consumed, profiles!inner(credit_balance)')
      .eq('live_id', liveId),
  ]);

  if (liveError) {
    throw new Error(`Failed to load live analytics: ${liveError.message}`);
  }

  if (!liveRow) {
    throw new Error('Live not found for analytics');
  }

  if (accessError) {
    throw new Error(`Failed to load live access analytics: ${accessError.message}`);
  }

  const rows = accessRows ?? [];
  const uniqueViewers = new Set<string>();
  let creditsConsumedTotal = 0;
  let creditsRemainingTotal = 0;

  for (const row of rows) {
    if (row.user_id) uniqueViewers.add(row.user_id as string);
    creditsConsumedTotal += toNumber((row as { credits_consumed?: unknown }).credits_consumed, 0);
    creditsRemainingTotal += toNumber((row as any).profiles?.credit_balance, 0);
  }

  const createdAt = liveRow.created_at ? Date.parse(liveRow.created_at as string) : null;
  const liveDurationMs = createdAt ? Math.max(0, Date.now() - createdAt) : 0;
  const creatorPercent = toNumber(liveRow.creator_percent, 0) / 100;
  const price = toNumber(liveRow.price, 0);
  const creatorRevenuePerCredit = creatorPercent > 0 ? (price * creatorPercent) / 1800 : 0;
  const estimatedEarnings = creditsConsumedTotal * creatorRevenuePerCredit;

  return {
    liveId,
    current_viewers: rows.length,
    total_unique_viewers: uniqueViewers.size,
    credits_consumed_total: creditsConsumedTotal,
    credits_remaining_total: creditsRemainingTotal,
    credits_remaining_average: rows.length ? creditsRemainingTotal / rows.length : 0,
    live_duration_ms: liveDurationMs,
    creator_revenue_per_credit: creatorRevenuePerCredit,
    estimated_earnings: estimatedEarnings,
  };
};

type CreatorOwnershipRecord = {
  id: string;
  user_id: string;
};

const fetchCreatorById = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('creators')
    .select('id, user_id')
    .eq('id', creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load creator: ${error.message}`);
  }

  return data as CreatorOwnershipRecord | null;
};

export const ensureCreatorOwnedByProfile = async (
  creatorId: string,
  profileId: string,
) => {
  const creator = await fetchCreatorById(creatorId);

  if (!creator) {
    throw new Error('Creator not found');
  }

  if (creator.user_id !== profileId) {
    throw new Error('Creator does not belong to the supplied profile');
  }

  return creator;
};
const ensureCreatorBalanceRow = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('creator_balance')
    .select('id, creator_id, balance')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load balance row: ${error.message}`);
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('creator_balance')
    .insert({ creator_id: creatorId, balance: 0 })
    .select('id, creator_id, balance')
    .single();

  if (insertError) {
    throw new Error(`Failed to initialize balance: ${insertError.message}`);
  }

  return inserted;
};

const upsertCreatorBalance = async (creatorId: string, delta: number) => {
  if (!Number.isFinite(delta) || delta === 0) {
    await ensureCreatorBalanceRow(creatorId);
    return null;
  }

  const existing = await ensureCreatorBalanceRow(creatorId);
  const currentBalance = normalizeNumber(existing?.balance as number | string | null);
  const nextBalance = Number((currentBalance + delta).toFixed(2));

  const payload: Record<string, unknown> = {
    creator_id: creatorId,
    balance: nextBalance,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    payload.id = existing.id;
  }

  const { data, error } = await supabase
    .from('creator_balance')
    .upsert(payload, { onConflict: 'creator_id' })
    .select('id, creator_id, balance')
    .single();

  if (error) {
    throw new Error(`Failed to update balance: ${error.message}`);
  }

  return data;
};

export const addCreatorEarnings = async (creatorId: string, amount: number) => {
  return upsertCreatorBalance(creatorId, amount);
};

export const addParentEarnings = async (parentCreatorId: string, amount: number) => {
  return upsertCreatorBalance(parentCreatorId, amount);
};

const aggregateCreatorCommissionTotals = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('commissions')
    .select('commission_amount')
    .eq('creator_id', creatorId);

  if (error) {
    throw new Error(`Failed to load commissions: ${error.message}`);
  }

  let directTotal = 0;
  let affiliateTotal = 0;

  (data ?? []).forEach((row) => {
    const amount = normalizeNumber(row.commission_amount as number | string | null);
    if (amount <= 0) {
      return;
    }

    if (amount < AFFILIATE_THRESHOLD) {
      affiliateTotal += amount;
    } else {
      directTotal += amount;
    }
  });

  return {
    directTotal: Number(directTotal.toFixed(2)),
    affiliateTotal: Number(affiliateTotal.toFixed(2)),
  };
};

export const recordCommissionEntry = async (creatorId: string, paymentId: string, amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from('commissions')
    .select('id')
    .eq('creator_id', creatorId)
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to verify commission: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from('commissions')
    .insert({
      creator_id: creatorId,
      payment_id: paymentId,
      commission_amount: Number(amount.toFixed(2)),
    })
    .select('id, creator_id, commission_amount')
    .single();

  if (error) {
    throw new Error(`Failed to insert commission: ${error.message}`);
  }

  return data;
};

export const recordPlatformRevenue = async (paymentId: string, amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from('platform_revenue')
    .select('id')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to verify platform revenue: ${existingError.message}`);
  }

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('platform_revenue')
      .update({ amount: Number(amount.toFixed(2)), created_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id, payment_id, amount')
      .single();

    if (updateError) {
      throw new Error(`Failed to update platform revenue: ${updateError.message}`);
    }

    return updated;
  }

  const { data, error } = await supabase
    .from('platform_revenue')
    .insert({ payment_id: paymentId, amount: Number(amount.toFixed(2)) })
    .select('id, payment_id, amount')
    .single();

  if (error) {
    throw new Error(`Failed to record platform revenue: ${error.message}`);
  }

  return data;
};

export const hasProcessedWebhookEvent = async (idempotencyKey?: string, bodyHash?: string) => {
  if (!idempotencyKey) {
    return false;
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .select('idempotency_key, body_hash')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to inspect webhook event: ${error.message}`);
  }

  if (data && bodyHash && data.body_hash && data.body_hash !== bodyHash) {
    logger.warn({
      event: 'webhook.body_hash.mismatch',
      idempotencyKey,
    });
  }

  return Boolean(data);
};

export const markWebhookEventProcessed = async (idempotencyKey?: string, bodyHash?: string) => {
  if (!idempotencyKey) {
    return null;
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .upsert(
      { idempotency_key: idempotencyKey, processed_at: new Date().toISOString(), body_hash: bodyHash },
      { onConflict: 'idempotency_key' },
    )
    .select('idempotency_key, processed_at, body_hash')
    .single();

  if (error) {
    throw new Error(`Failed to persist webhook idempotency key: ${error.message}`);
  }

  return data;
};

type RecordReferralInput = {
  referralCode: string;
  newCreatorId: string;
};

export const recordReferralConversion = async ({ referralCode, newCreatorId }: RecordReferralInput) => {
  const trimmedCode = referralCode.trim();

  if (!trimmedCode) {
    throw new Error('Referral code is required');
  }

  const { data: referralLink, error: referralError } = await supabase
    .from('referral_links')
    .select('creator_id')
    .eq('code', trimmedCode)
    .maybeSingle();

  if (referralError) {
    throw new Error(`Failed to load referral link: ${referralError.message}`);
  }

  if (!referralLink) {
    throw new Error('Invalid referral code');
  }

  const parentCreatorId = referralLink.creator_id as string;

  const { data: existing, error: existingError } = await supabase
    .from('referral_conversions')
    .select('id')
    .eq('new_creator_id', newCreatorId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to verify referral conversion: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from('referral_conversions')
    .insert({
      referral_code: trimmedCode,
      parent_creator_id: parentCreatorId,
      new_creator_id: newCreatorId,
      commission_amount: 0.5,
    })
    .select('id, parent_creator_id, new_creator_id')
    .single();

  if (error) {
    throw new Error(`Failed to insert referral conversion: ${error.message}`);
  }

  return data;
};

export const getCreatorParent = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('referral_conversions')
    .select('parent_creator_id')
    .eq('new_creator_id', creatorId)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch creator parent: ${error.message}`);
  }

  return (data?.parent_creator_id as string | null | undefined) || null;
};

type RegisterCreatorInput = {
  profileId: string;
  bio?: string;
  pricePerMinute?: number;
  referralCode?: string;
};

export const registerCreatorProfile = async ({
  profileId,
  bio,
  pricePerMinute,
  referralCode,
}: RegisterCreatorInput) => {
  const { data: existing, error: existingError } = await supabase
    .from('creators')
    .select('id')
    .eq('user_id', profileId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to verify creator: ${existingError.message}`);
  }

  if (existing) {
    throw new Error('Creator already registered for this profile');
  }

  const payload: Record<string, unknown> = {
    user_id: profileId,
    bio: bio ?? null,
  };

  if (pricePerMinute !== undefined && pricePerMinute !== null) {
    payload.price_per_minute = Number(pricePerMinute);
  }

  const { data, error } = await supabase
    .from('creators')
    .insert(payload)
    .select('id, user_id, bio, price_per_minute')
    .single();

  if (error) {
    throw new Error(`Failed to create creator: ${error.message}`);
  }

  await ensureCreatorBalanceRow(data.id as string);

  if (referralCode) {
    await recordReferralConversion({ referralCode, newCreatorId: data.id as string });
  }

  return data;
};

export const getCreatorByProfileId = async (profileId: string) => {
  const { data, error } = await supabase
    .from('creators')
    .select('id, user_id')
    .eq('user_id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load creator by profile: ${error.message}`);
  }

  return data as { id: string; user_id: string } | null;
};

export const getProfileById = async (profileId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, username, credit_balance, referrer_root, referrer_direct, affiliate_earnings, is_root_creator, referrer_id, referrer_parent_id',
    )
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return data;
};

export const upsertProfileReferralMetadata = async (
  profileId: string,
  updates: Record<string, string | boolean | null>,
) => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to persist referral metadata: ${error.message}`);
  }
};

export const ensureCreatorOwnsLive = async (liveId: string, profileId: string) => {
  const live = await getLiveWithCreator(liveId);

  if (!live) {
    throw new Error('Live not found');
  }

  if (live.creator_profile_id !== profileId) {
    throw new Error('Creator does not own this live');
  }

  return live;
};

export const getCreatorBalance = async (creatorId: string) => {
  const balanceRow = await ensureCreatorBalanceRow(creatorId);
  const balance = normalizeNumber(balanceRow?.balance as number | string | null);

  const { directTotal, affiliateTotal } = await aggregateCreatorCommissionTotals(creatorId);

  const { data: withdrawals, error: withdrawalsError } = await supabase
    .from('withdrawals')
    .select('amount, status, processed_at')
    .eq('creator_id', creatorId);

  if (withdrawalsError) {
    throw new Error(`Failed to load withdrawals: ${withdrawalsError.message}`);
  }

  let totalWithdrawn = 0;
  let pendingWithdrawals = 0;

  const processedStatuses = new Set(['approved', 'paid']);

  (withdrawals ?? []).forEach((row) => {
    const amount = normalizeNumber(row.amount as number | string | null);
    const status = (row.status ?? 'pending').toString().toLowerCase();
    const processed = Boolean(row.processed_at) || processedStatuses.has(status);

    if (status === 'pending') {
      pendingWithdrawals += amount;
    } else if (processed) {
      totalWithdrawn += amount;
    }
  });

  return {
    balance: Number(balance.toFixed(2)),
    total_earned: Number(directTotal.toFixed(2)),
    total_affiliate_earned: Number(affiliateTotal.toFixed(2)),
    total_withdrawn: Number(totalWithdrawn.toFixed(2)),
    pending_withdrawals: Number(pendingWithdrawals.toFixed(2)),
  };
};

export const getCreatorCommissions = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('commissions')
    .select('id, payment_id, commission_amount, created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load commissions: ${error.message}`);
  }

  return data ?? [];
};

export const getCreatorReferralData = async (creatorId: string) => {
  const { data: referralLink, error: referralError } = await supabase
    .from('referral_links')
    .select('id, code, created_at')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (referralError) {
    throw new Error(`Failed to load referral link: ${referralError.message}`);
  }

  const { data: conversions, error: conversionsError } = await supabase
    .from('referral_conversions')
    .select('id, referral_code, new_creator_id, commission_amount, created_at')
    .eq('parent_creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (conversionsError) {
    throw new Error(`Failed to load referral conversions: ${conversionsError.message}`);
  }

  const { affiliateTotal } = await aggregateCreatorCommissionTotals(creatorId);

  return {
    referral_link: referralLink ?? null,
    conversions: conversions ?? [],
    total_affiliate_earned: Number(affiliateTotal.toFixed(2)),
  };
};

const randomReferralCode = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = Math.floor(Math.random() * 3) + 8; // 8-10 chars
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return output;
};

export const createOrGetReferralCode = async (creatorId: string) => {
  const { data: existing, error: existingError } = await supabase
    .from('referral_links')
    .select('id, code, created_at')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load referral link: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  let attempts = 0;
  while (attempts < 5) {
    const code = randomReferralCode();
    const { data, error } = await supabase
      .from('referral_links')
      .insert({ creator_id: creatorId, code })
      .select('id, code, created_at')
      .single();

    if (!error) {
      logger.info({ event: 'referrals.code.created', creatorId, referralId: data.id });
      return data;
    }

    if (!error.message.includes('duplicate key')) {
      throw new Error(`Failed to create referral link: ${error.message}`);
    }

    attempts += 1;
  }

  throw new Error('Unable to generate unique referral code');
};

export const submitWithdrawal = async (creatorId: string, amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Withdrawal amount must be positive');
  }

  const balanceRow = await ensureCreatorBalanceRow(creatorId);
  const balance = normalizeNumber(balanceRow?.balance as number | string | null);

  if (amount > balance) {
    throw new Error('Insufficient balance for withdrawal');
  }

  const payload = {
    creator_id: creatorId,
    amount: Number(amount.toFixed(2)),
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('withdrawals')
    .insert(payload)
    .select('id, amount, status, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to submit withdrawal: ${error.message}`);
  }

  await upsertCreatorBalance(creatorId, -amount);

  logger.info({ event: 'withdrawals.recorded', creatorId, withdrawalId: data.id, amount: data.amount });

  return data;
};

export const getWithdrawalHistory = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, amount, status, created_at, processed_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load withdrawals: ${error.message}`);
  }

  return data ?? [];
};

type WithdrawalRecord = {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  processed_at?: string | null;
};

const fetchWithdrawalById = async (withdrawalId: string) => {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, creator_id, amount, status, processed_at')
    .eq('id', withdrawalId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load withdrawal: ${error.message}`);
  }

  if (!data) {
    throw new Error('Withdrawal not found');
  }

  return data as WithdrawalRecord;
};

const logWithdrawalAudit = async ({
  withdrawalId,
  action,
  actorProfileId,
  note,
}: {
  withdrawalId: string;
  action: string;
  actorProfileId?: string;
  note?: string;
}) => {
  const { error } = await supabase.from('withdrawal_audit_log').insert({
    withdrawal_id: withdrawalId,
    action,
    actor_profile_id: actorProfileId ?? null,
    note: note ?? null,
  });

  if (error) {
    throw new Error(`Failed to record withdrawal audit entry: ${error.message}`);
  }
};

export const getPendingWithdrawalsForAdmin = async () => {
  const { data, error } = await supabase
    .from('withdrawals')
    .select(
      `id, creator_id, amount, status, created_at, processed_at,
        creators:creator_id (
          id,
          user_id,
          profiles:user_id (
            id,
            email,
            username
          )
        )`,
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load pending withdrawals: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const creatorProfiles = (row as Record<string, any>).creators?.profiles;
    const profileDetails = Array.isArray(creatorProfiles)
      ? creatorProfiles[0]
      : creatorProfiles ?? null;

    return {
      id: row.id,
      amount: row.amount,
      status: row.status,
      created_at: row.created_at,
      processed_at: row.processed_at,
      creator_id: row.creator_id,
      creator_profile: profileDetails,
    };
  });
};

export const approveWithdrawalRequest = async (
  withdrawalId: string,
  adminProfileId: string,
  note?: string,
) => {
  const existing = await fetchWithdrawalById(withdrawalId);

  if (existing.status !== 'pending') {
    throw new Error('Only pending withdrawals can be approved');
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('withdrawals')
    .update({ status: 'approved', processed_at: now })
    .eq('id', withdrawalId)
    .select('id, creator_id, amount, status, processed_at')
    .single();

  if (error) {
    throw new Error(`Failed to approve withdrawal: ${error.message}`);
  }

  await logWithdrawalAudit({
    withdrawalId,
    action: 'approved',
    actorProfileId: adminProfileId,
    note,
  });

  return data;
};

export const rejectWithdrawalRequest = async (
  withdrawalId: string,
  adminProfileId: string,
  note?: string,
) => {
  const existing = await fetchWithdrawalById(withdrawalId);

  if (existing.status !== 'pending' && existing.status !== 'approved') {
    throw new Error('Only pending or approved withdrawals can be rejected');
  }

  const now = new Date().toISOString();
  const amount = normalizeNumber(existing.amount);

  const { data, error } = await supabase
    .from('withdrawals')
    .update({ status: 'rejected', processed_at: now })
    .eq('id', withdrawalId)
    .select('id, creator_id, amount, status, processed_at')
    .single();

  if (error) {
    throw new Error(`Failed to reject withdrawal: ${error.message}`);
  }

  await upsertCreatorBalance(existing.creator_id, amount);

  await logWithdrawalAudit({
    withdrawalId,
    action: 'rejected',
    actorProfileId: adminProfileId,
    note,
  });

  return data;
};

export const markWithdrawalPaid = async (
  withdrawalId: string,
  adminProfileId: string,
  note?: string,
) => {
  const existing = await fetchWithdrawalById(withdrawalId);

  if (existing.status !== 'approved') {
    throw new Error('Only approved withdrawals can be marked as paid');
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('withdrawals')
    .update({ status: 'paid', processed_at: now })
    .eq('id', withdrawalId)
    .select('id, creator_id, amount, status, processed_at')
    .single();

  if (error) {
    throw new Error(`Failed to mark withdrawal as paid: ${error.message}`);
  }

  await logWithdrawalAudit({
    withdrawalId,
    action: 'paid',
    actorProfileId: adminProfileId,
    note,
  });

  return data;
};

export const recordLiveHeartbeat = async (
  liveId: string,
  creatorId: string,
  cameraActive: boolean,
) => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('live_heartbeat')
    .upsert(
      {
        live_id: liveId,
        creator_id: creatorId,
        last_heartbeat: now,
        camera_active: cameraActive,
        updated_at: now,
      },
      { onConflict: 'live_id' },
    )
    .select('id, live_id, creator_id, last_heartbeat, camera_active')
    .single();

  if (error) {
    throw new Error(`Failed to record live heartbeat: ${error.message}`);
  }

  return data;
};

export type LiveHeartbeatSummary = {
  liveId: string;
  creatorId: string;
  lastHeartbeat: string;
  cameraActive: boolean;
  status: LiveLifecycleStatus | null;
};

export const getActiveLivesWithHeartbeat = async (): Promise<LiveHeartbeatSummary[]> => {
  const { data: activeLives, error: livesError } = await supabase
    .from('lives')
    .select('id, creator_id, is_active, status')
    .eq('is_active', true);

  if (livesError) {
    throw new Error(`Failed to load active lives: ${livesError.message}`);
  }

  if (!activeLives || activeLives.length === 0) {
    return [];
  }

  const activeLookup = new Map<string, { status: LiveLifecycleStatus | null }>();
  activeLives.forEach((live) => {
    activeLookup.set(live.id as string, { status: normalizeStatus(live.status as string | null) });
  });

  const liveIds = Array.from(activeLookup.keys());

  const { data: heartbeatRows, error: heartbeatError } = await supabase
    .from('live_heartbeat')
    .select('live_id, creator_id, last_heartbeat, camera_active')
    .in('live_id', liveIds);

  if (heartbeatError) {
    throw new Error(`Failed to load live heartbeat rows: ${heartbeatError.message}`);
  }

  const summaries: LiveHeartbeatSummary[] = [];

  (heartbeatRows ?? []).forEach((row) => {
    const liveId = row.live_id as string;
    const meta = activeLookup.get(liveId);

    if (!meta) {
      return;
    }

    if ((meta.status ?? '').toLowerCase() === 'ended') {
      return;
    }

    summaries.push({
      liveId,
      creatorId: row.creator_id as string,
      cameraActive: Boolean(row.camera_active),
      lastHeartbeat: row.last_heartbeat as string,
      status: meta.status ?? null,
    });
  });

  return summaries;
};

export const countActiveLives = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('lives')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to count active lives: ${error.message}`);
  }

  return count ?? 0;
};

export const getLatestHeartbeatTimestamp = async (): Promise<string | null> => {
  const { data, error } = await supabase
    .from('live_heartbeat')
    .select('updated_at, last_heartbeat')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest heartbeat timestamp: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return (data.updated_at as string | null) ?? (data.last_heartbeat as string | null) ?? null;
};

export const endLive = async (liveId: string, reason: string) => {
  const endedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('lives')
    .update({
      is_active: false,
      status: 'ended',
      ended_at: endedAt,
    })
    .eq('id', liveId)
    .select('id, creator_id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to end live: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const creatorId = data.creator_id as string;

  const { error: logError } = await supabase.from('live_end_log').insert({
    live_id: liveId,
    creator_id: creatorId,
    reason,
    ended_at: endedAt,
  });

  if (logError) {
    throw new Error(`Failed to write live end log: ${logError.message}`);
  }

  const { error: heartbeatDeleteError } = await supabase
    .from('live_heartbeat')
    .delete()
    .eq('live_id', liveId);

  if (heartbeatDeleteError) {
    throw new Error(`Failed to clean up heartbeat row: ${heartbeatDeleteError.message}`);
  }

  return data;
};

const REQUIRED_TABLES = [
  'profiles',
  'creators',
  'lives',
  'payments',
  'live_access',
  'commissions',
  'referral_links',
  'referral_conversions',
  'creator_balance',
  'withdrawals',
  'withdrawal_audit_log',
  'platform_revenue',
  'webhook_events',
  'affiliate_logs',
  'live_heartbeat',
  'live_end_log',
];

export const getRequiredTables = () => [...REQUIRED_TABLES];

export const checkSupabaseConnectivity = async () => {
  const { error } = await supabase.from('profiles').select('*', { head: true, count: 'exact' });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
};

export const verifyRequiredTables = async () => {
  const missing: string[] = [];

  await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
      if (error) {
        missing.push(table);
      }
    }),
  );

  return { ok: missing.length === 0, missing };
};
