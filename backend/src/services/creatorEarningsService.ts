import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/supabaseTypes';

type CreatorEarningsRow = Tables<'creator_earnings'>;
type LivesRow = Tables<'lives'>;
type CreatorsRow = Tables<'creators'>;
type CreatorWalletRow = Tables<'creator_wallet'>;

export type SettleLiveEarningsResult = {
  liveId: string;
  creatorId: string;
  totalCreditsConsumed: number;
  grossCents: number;
  netCents: number;
  platformCents: number;
  createdOrUpdatedEarningsId: string | null;
};

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

const ensureCreatorWallet = async (
  client: SupabaseClient<Database>,
  creatorId: string,
  nowIso: string,
): Promise<CreatorWalletRow> => {
  const { data, error } = await client
    .from('creator_wallet')
    .select('creator_id, balance_cents, pending_cents, updated_at')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load creator wallet: ${error.message}`);
  }

  if (data) return data as CreatorWalletRow;

  const { data: inserted, error: insertError } = await client
    .from('creator_wallet')
    .insert({ creator_id: creatorId, balance_cents: 0, pending_cents: 0, updated_at: nowIso })
    .select('creator_id, balance_cents, pending_cents, updated_at')
    .maybeSingle();

  if (insertError || !inserted) {
    throw new Error(`Failed to create creator wallet: ${insertError?.message ?? 'unknown error'}`);
  }

  return inserted as CreatorWalletRow;
};

export const createCreatorEarningsService = ({ client }: { client: SupabaseClient<Database> }) => {
  const resolveCreatorProfileId = async (liveId: string): Promise<string> => {
    const { data, error } = await client
      .from('lives')
      .select('id, creator_id')
      .eq('id', liveId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load live: ${error.message}`);
    }

    if (!data) {
      throw new Error('Live not found');
    }

    const live = data as LivesRow;
    const creatorId = live.creator_id as string | null;

    if (!creatorId) {
      throw new Error('Live has no creator_id');
    }

    // In this schema creators.user_id references profiles.id
    const { data: creator, error: creatorError } = await client
      .from('creators')
      .select('id, user_id')
      .eq('id', creatorId)
      .maybeSingle();

    if (creatorError) {
      throw new Error(`Failed to load creator for live: ${creatorError.message}`);
    }

    if (!creator || !creator.user_id) {
      throw new Error('Creator not found or missing user_id');
    }

    return (creator as CreatorsRow).user_id as string;
  };

  const aggregateCredits = async (liveId: string): Promise<number> => {
    const { data, error } = await client
      .from('live_consumption')
      .select('credits_consumed')
      .eq('live_id', liveId);

    if (error) {
      throw new Error(`Failed to aggregate consumption: ${error.message}`);
    }

    return (data ?? []).reduce((sum, row) => sum + (row.credits_consumed ?? 0), 0);
  };

  const settleLiveEarnings = async ({ liveId }: { liveId: string }): Promise<SettleLiveEarningsResult> => {
    const nowIso = toIso(new Date());
    const creatorId = await resolveCreatorProfileId(liveId);
    const totalCreditsConsumed = await aggregateCredits(liveId);

    const grossCents = Math.floor((totalCreditsConsumed * 500) / 180);
    const netCents = Math.floor((grossCents * 80) / 100);
    const platformCents = grossCents - netCents;

    const { data: existing, error: fetchError } = await client
      .from('creator_earnings')
      .select('id, status, creator_amount_cents')
      .eq('live_id', liveId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to load creator earnings: ${fetchError.message}`);
    }

    let earningsId: string | null = existing?.id ?? null;
    let walletDelta = netCents;

    if (existing) {
      const status = (existing.status ?? 'pending').toString().toLowerCase();
      if (status === 'settled' || status === 'cancelled') {
        return {
          liveId,
          creatorId,
          totalCreditsConsumed,
          grossCents,
          netCents,
          platformCents,
          createdOrUpdatedEarningsId: earningsId,
        };
      }

      const previousNet = existing.creator_amount_cents ?? 0;
      walletDelta = Math.max(0, netCents - previousNet);

      const { error: updateError } = await client
        .from('creator_earnings')
        .update({
          credits_consumed: totalCreditsConsumed,
          gross_amount_cents: grossCents,
          creator_amount_cents: netCents,
          platform_amount_cents: platformCents,
          status: 'pending',
          settled_at: null,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Failed to update creator earnings: ${updateError.message}`);
      }
    } else {
      const { data: inserted, error: insertError } = await client
        .from('creator_earnings')
        .insert({
          creator_id: creatorId,
          live_id: liveId,
          credits_consumed: totalCreditsConsumed,
          gross_amount_cents: grossCents,
          creator_amount_cents: netCents,
          platform_amount_cents: platformCents,
          status: 'pending',
          created_at: nowIso,
        })
        .select('id')
        .maybeSingle();

      if (insertError || !inserted) {
        throw new Error(`Failed to insert creator earnings: ${insertError?.message ?? 'unknown error'}`);
      }

      earningsId = inserted.id as string;
    }

    if (walletDelta > 0) {
      const wallet = await ensureCreatorWallet(client, creatorId, nowIso);
      const nextBalance = wallet.balance_cents + walletDelta;

      const { error: walletError } = await client
        .from('creator_wallet')
        .update({ balance_cents: nextBalance, updated_at: nowIso })
        .eq('creator_id', creatorId);

      if (walletError) {
        throw new Error(`Failed to update creator wallet: ${walletError.message}`);
      }
    }

    return {
      liveId,
      creatorId,
      totalCreditsConsumed,
      grossCents,
      netCents,
      platformCents,
      createdOrUpdatedEarningsId: earningsId,
    };
  };

  return { settleLiveEarnings };
};
