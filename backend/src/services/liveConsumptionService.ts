import type { SupabaseClient } from '@supabase/supabase-js';

export type LiveConsumptionRow = {
  id: string;
  live_id: string;
  user_id: string;
  session_token: string;
  seconds_watched: number;
  credits_consumed: number;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string | null;
};

export type CreditsWalletRow = {
  profile_id: string;
  balance_credits: number;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      live_consumption: { Row: LiveConsumptionRow };
      credits_wallet: { Row: CreditsWalletRow };
    };
  };
};

type LiveConsumptionServiceDeps = {
  client: SupabaseClient<Database>;
};

export type GetOrCreateConsumptionParams = {
  liveId: string;
  userId: string;
  sessionToken: string;
  now: Date;
};

export type ApplyHeartbeatParams = {
  liveId: string;
  userId: string;
  sessionToken: string;
  now: Date;
};

export type ApplyHeartbeatResult = {
  updated: boolean;
  secondsWatched: number;
  creditsConsumed: number;
  creditsChargedThisTick: number;
  ranOutOfCredits: boolean;
};

const LIVE_CONSUMPTION_FIELDS =
  'id, live_id, user_id, session_token, seconds_watched, credits_consumed, started_at, ended_at, last_heartbeat_at';

const asIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

const ensureWallet = async (
  client: SupabaseClient<Database>,
  profileId: string,
  nowIso: string,
): Promise<CreditsWalletRow> => {
  const { data, error } = await client
    .from('credits_wallet')
    .select('profile_id, balance_credits, updated_at')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load credits wallet: ${error.message}`);
  }

  if (data) {
    return data as unknown as CreditsWalletRow;
  }

  const { data: inserted, error: insertError } = await client
    .from('credits_wallet')
    .insert({ profile_id: profileId, balance_credits: 0, updated_at: nowIso } as never)
    .select('profile_id, balance_credits, updated_at')
    .maybeSingle();

  if (insertError || !inserted) {
    throw new Error(`Failed to create credits wallet: ${insertError?.message ?? 'unknown error'}`);
  }

  return inserted as unknown as CreditsWalletRow;
};

export const createLiveConsumptionService = ({ client }: LiveConsumptionServiceDeps) => {
  const getOrCreateConsumptionSession = async ({
    liveId,
    userId,
    sessionToken,
    now,
  }: GetOrCreateConsumptionParams): Promise<LiveConsumptionRow> => {
    const nowIso = asIso(now);

    const { data, error } = await client
      .from('live_consumption')
      .select(LIVE_CONSUMPTION_FIELDS)
      .eq('live_id', liveId)
      .eq('user_id', userId)
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load live consumption session: ${error.message}`);
    }

    if (data) {
      return data as unknown as LiveConsumptionRow;
    }

    const { data: inserted, error: insertError } = await client
      .from('live_consumption')
      .insert({
        live_id: liveId,
        user_id: userId,
        session_token: sessionToken,
        started_at: nowIso,
        last_heartbeat_at: nowIso,
      } as never)
      .select(LIVE_CONSUMPTION_FIELDS)
      .maybeSingle();

    if (insertError || !inserted) {
      throw new Error(`Failed to create live consumption session: ${insertError?.message ?? 'unknown error'}`);
    }

    return inserted as unknown as LiveConsumptionRow;
  };

  const applyHeartbeatAndChargeCredits = async ({
    liveId,
    userId,
    sessionToken,
    now,
  }: ApplyHeartbeatParams): Promise<ApplyHeartbeatResult> => {
    const nowIso = asIso(now);
    const session = await getOrCreateConsumptionSession({ liveId, userId, sessionToken, now });

    const previousSeconds = session.seconds_watched ?? 0;
    const previousCredits = session.credits_consumed ?? 0;
    const lastHeartbeat = session.last_heartbeat_at ?? session.started_at ?? nowIso;

    const elapsedMs = Math.max(0, now.getTime() - new Date(lastHeartbeat).getTime());
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const newSecondsWatched = previousSeconds + elapsedSeconds;
    const totalCreditsShouldHaveBeenConsumed = Math.floor(newSecondsWatched / 10);
    const newCreditsToCharge = totalCreditsShouldHaveBeenConsumed - previousCredits;

    const persistBase = async (patch: Partial<LiveConsumptionRow>) => {
      const { error } = await client
        .from('live_consumption')
        .update(patch as never)
        .eq('id', session.id);

      if (error) {
        throw new Error(`Failed to update live consumption: ${error.message}`);
      }
    };

    if (newCreditsToCharge <= 0) {
      await persistBase({ seconds_watched: newSecondsWatched, last_heartbeat_at: nowIso });

      return {
        updated: true,
        secondsWatched: newSecondsWatched,
        creditsConsumed: previousCredits,
        creditsChargedThisTick: 0,
        ranOutOfCredits: false,
      };
    }

    const wallet = await ensureWallet(client, userId, nowIso);

    if (wallet.balance_credits >= newCreditsToCharge) {
      const nextWalletBalance = wallet.balance_credits - newCreditsToCharge;

      const { error: walletError } = await client
        .from('credits_wallet')
        .update({ balance_credits: nextWalletBalance, updated_at: nowIso } as never)
        .eq('profile_id', userId)
        .eq('balance_credits', wallet.balance_credits);

      if (walletError) {
        throw new Error(`Failed to decrement wallet credits: ${walletError.message}`);
      }

      await persistBase({
        seconds_watched: newSecondsWatched,
        last_heartbeat_at: nowIso,
        credits_consumed: totalCreditsShouldHaveBeenConsumed,
      });

      return {
        updated: true,
        secondsWatched: newSecondsWatched,
        creditsConsumed: totalCreditsShouldHaveBeenConsumed,
        creditsChargedThisTick: newCreditsToCharge,
        ranOutOfCredits: false,
      };
    }

    const available = Math.max(0, wallet.balance_credits);
    const chargeableSeconds = available * 10;
    const cappedSecondsWatched = Math.min(newSecondsWatched, previousSeconds + chargeableSeconds);
    const creditsActuallyCharged = available;
    const nextCreditsConsumed = previousCredits + creditsActuallyCharged;

    const { error: zeroWalletError } = await client
      .from('credits_wallet')
      .update({ balance_credits: 0, updated_at: nowIso } as never)
      .eq('profile_id', userId);

    if (zeroWalletError) {
      throw new Error(`Failed to zero wallet after partial charge: ${zeroWalletError.message}`);
    }

    await persistBase({
      seconds_watched: cappedSecondsWatched,
      last_heartbeat_at: nowIso,
      credits_consumed: nextCreditsConsumed,
      ended_at: nowIso,
    });

    return {
      updated: true,
      secondsWatched: cappedSecondsWatched,
      creditsConsumed: nextCreditsConsumed,
      creditsChargedThisTick: creditsActuallyCharged,
      ranOutOfCredits: true,
    };
  };

  return {
    getOrCreateConsumptionSession,
    applyHeartbeatAndChargeCredits,
  };
};
