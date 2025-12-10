import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline types and logic from liveMonitorCore (edge functions can't import from backend)
type LiveLifecycleStatus =
  | 'scheduled'
  | 'waiting_for_host'
  | 'live'
  | 'inactive'
  | 'ending'
  | 'ended';

type MonitorTerminationReason = 'camera_inactive' | 'host_absent';

type LiveHeartbeatSummaryLite = {
  liveId: string;
  cameraActive: boolean;
  lastHeartbeat: string;
  status: LiveLifecycleStatus | null;
};

type MonitorEvaluation = {
  endedLives: {
    liveId: string;
    reason: MonitorTerminationReason;
    status: LiveLifecycleStatus | null;
  }[];
};

const HOST_ABSENT_THRESHOLD_MS = 10 * 60 * 1000;
const CAMERA_INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

const toTimestamp = (input: string): number | null => {
  const value = Date.parse(input);
  return Number.isNaN(value) ? null : value;
};

const evaluateLiveHeartbeats = (
  summaries: LiveHeartbeatSummaryLite[],
  now: number | Date = Date.now(),
): MonitorEvaluation => {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const endedLives: MonitorEvaluation['endedLives'] = [];

  for (const summary of summaries) {
    const lastHeartbeatMs = toTimestamp(summary.lastHeartbeat);

    if (!lastHeartbeatMs) {
      continue;
    }

    const delta = nowMs - lastHeartbeatMs;

    if (!summary.cameraActive && delta > CAMERA_INACTIVE_THRESHOLD_MS) {
      endedLives.push({
        liveId: summary.liveId,
        reason: 'camera_inactive',
        status: summary.status ?? null,
      });
      continue;
    }

    if (delta > HOST_ABSENT_THRESHOLD_MS) {
      endedLives.push({
        liveId: summary.liveId,
        reason: 'host_absent',
        status: summary.status ?? null,
      });
    }
  }

  return { endedLives };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pollIntervalMs = Number(Deno.env.get('HEARTBEAT_POLL_INTERVAL_MS') ?? '60000');

const normalizeStatus = (value: unknown): LiveLifecycleStatus | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase();

  if (
    normalized === 'scheduled' ||
    normalized === 'waiting_for_host' ||
    normalized === 'live' ||
    normalized === 'inactive' ||
    normalized === 'ending' ||
    normalized === 'ended'
  ) {
    return normalized as LiveLifecycleStatus;
  }

  return null;
};

const fetchActiveLivesWithHeartbeat = async (): Promise<LiveHeartbeatSummaryLite[]> => {
  const { data: activeLives, error: livesError } = await supabase
    .from('lives')
    .select('id, status')
    .eq('is_active', true);

  if (livesError) {
    throw new Error(`Failed to load active lives: ${livesError.message}`);
  }

  if (!activeLives || activeLives.length === 0) {
    return [];
  }

  const liveIdToStatus = new Map<string, LiveLifecycleStatus | null>();
  activeLives.forEach((live: { id: string; status: unknown }) => {
    const status = normalizeStatus(live.status);
    liveIdToStatus.set(live.id, status);
  });

  const liveIds = Array.from(liveIdToStatus.keys());
  const { data: heartbeatRows, error: heartbeatError } = await supabase
    .from('live_heartbeat')
    .select('live_id, last_heartbeat, camera_active')
    .in('live_id', liveIds);

  if (heartbeatError) {
    throw new Error(`Failed to load heartbeat rows: ${heartbeatError.message}`);
  }

  return (heartbeatRows ?? [])
    .map((row: { live_id: string; last_heartbeat: string; camera_active: boolean }) => {
      const liveId = row.live_id;
      const status = liveIdToStatus.get(liveId) ?? null;

      if (status === 'ended') {
        return null;
      }

      return {
        liveId,
        cameraActive: Boolean(row.camera_active),
        lastHeartbeat: row.last_heartbeat,
        status,
      } as LiveHeartbeatSummaryLite;
    })
    .filter(Boolean) as LiveHeartbeatSummaryLite[];
};

const updateLiveLifecycleStatus = async (liveId: string, status: LiveLifecycleStatus) => {
  const { error } = await supabase.from('lives').update({ status }).eq('id', liveId);

  if (error) {
    throw new Error(`Failed to update live status (${liveId}): ${error.message}`);
  }
};

const settleLiveEarnings = async (liveId: string, creatorId: string) => {
  // Aggregate credits consumed for this live
  const { data: consumptionData, error: consumptionError } = await supabase
    .from('live_consumption')
    .select('credits_consumed')
    .eq('live_id', liveId);

  if (consumptionError) {
    console.error(`Failed to aggregate consumption for live ${liveId}:`, consumptionError.message);
    return null;
  }

  const totalCreditsConsumed = (consumptionData ?? []).reduce(
    (sum, row) => sum + (row.credits_consumed ?? 0),
    0
  );

  if (totalCreditsConsumed === 0) {
    console.log(`No credits consumed for live ${liveId}, skipping settlement`);
    return null;
  }

  // Calculate earnings: (credits / 180) * 500 = gross in centavos
  const grossCents = Math.floor((totalCreditsConsumed * 500) / 180);
  const creatorCents = Math.floor((grossCents * 80) / 100);
  const platformCents = grossCents - creatorCents;

  // Check if earnings already exist
  const { data: existingEarnings } = await supabase
    .from('creator_earnings')
    .select('id, status')
    .eq('live_id', liveId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existingEarnings) {
    const status = (existingEarnings.status ?? '').toLowerCase();
    if (status === 'settled' || status === 'cancelled') {
      console.log(`Live ${liveId} earnings already ${status}, skipping`);
      return existingEarnings.id;
    }

    // Update existing earnings
    await supabase
      .from('creator_earnings')
      .update({
        credits_consumed: totalCreditsConsumed,
        gross_amount_cents: grossCents,
        creator_amount_cents: creatorCents,
        platform_amount_cents: platformCents,
        status: 'settled',
        settled_at: nowIso,
      })
      .eq('id', existingEarnings.id);
  } else {
    // Insert new earnings record
    await supabase
      .from('creator_earnings')
      .insert({
        creator_id: creatorId,
        live_id: liveId,
        credits_consumed: totalCreditsConsumed,
        gross_amount_cents: grossCents,
        creator_amount_cents: creatorCents,
        platform_amount_cents: platformCents,
        status: 'settled',
        settled_at: nowIso,
        created_at: nowIso,
      });
  }

  // Update creator wallet
  const { data: wallet } = await supabase
    .from('creator_wallet')
    .select('balance_cents')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (wallet) {
    await supabase
      .from('creator_wallet')
      .update({ 
        balance_cents: (wallet.balance_cents || 0) + creatorCents,
        updated_at: nowIso,
      })
      .eq('creator_id', creatorId);
  } else {
    await supabase
      .from('creator_wallet')
      .insert({ 
        creator_id: creatorId, 
        balance_cents: creatorCents,
        total_earned_cents: creatorCents,
      });
  }

  // Record platform revenue (20%)
  await supabase.from('platform_revenue').insert({
    source_type: 'live_earnings',
    source_id: liveId,
    amount: platformCents,
    user_id: creatorId,
    metadata: { 
      credits_consumed: totalCreditsConsumed,
      gross_amount: grossCents,
      creator_amount: creatorCents,
    },
  });

  console.log(JSON.stringify({
    event: 'live.earnings.settled',
    liveId,
    creatorId,
    totalCreditsConsumed,
    grossCents,
    creatorCents,
    platformCents,
  }));

  return liveId;
};

const endLive = async (liveId: string, reason: string) => {
  const endedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('lives')
    .update({ is_active: false, status: 'ended', ended_at: endedAt })
    .eq('id', liveId)
    .select('id, creator_id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to end live (${liveId}): ${error.message}`);
  }

  if (data) {
    const creatorId = (data as { creator_id: string }).creator_id;

    // Settle earnings automatically when live ends
    try {
      await settleLiveEarnings(liveId, creatorId);
    } catch (settlementError) {
      console.error(`Failed to settle earnings for live ${liveId}:`, settlementError);
    }

    // Log live end (table may not exist, so we handle gracefully)
    try {
      await supabase.from('live_end_log').insert({
        live_id: liveId,
        creator_id: creatorId,
        reason,
        ended_at: endedAt,
      });
    } catch (logError) {
      console.warn(`Could not insert live end log (table may not exist):`, logError);
    }
  }

  // Cleanup heartbeat
  try {
    await supabase.from('live_heartbeat').delete().eq('live_id', liveId);
  } catch (cleanupError) {
    console.warn(`Failed to cleanup heartbeat row:`, cleanupError);
  }

  console.log(
    JSON.stringify({
      event: 'live.ended',
      liveId,
      reason,
      endedAt,
    }),
  );
};

const transitionToEndingAndClose = async (
  liveId: string,
  reason: string,
  currentStatus: LiveLifecycleStatus | null,
) => {
  if (currentStatus !== 'ending') {
    await updateLiveLifecycleStatus(liveId, 'ending');
  }

  await endLive(liveId, reason);
};

const runMonitorCycle = async () => {
  const summaries = await fetchActiveLivesWithHeartbeat();
  const evaluation = evaluateLiveHeartbeats(summaries);
  const endedLives: { liveId: string; reason: string }[] = [];

  for (const candidate of evaluation.endedLives) {
    await transitionToEndingAndClose(candidate.liveId, candidate.reason, candidate.status);
    endedLives.push({ liveId: candidate.liveId, reason: candidate.reason });
  }

  return {
    evaluatedLives: summaries.length,
    endedLives,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', {
      headers: corsHeaders,
      status: 405,
    });
  }

  const cycleStartedAt = Date.now();
  console.log(
    JSON.stringify({ event: 'monitor-lives.cycle.start', method: req.method, intervalMs: pollIntervalMs }),
  );

  try {
    const result = await runMonitorCycle();
    const durationMs = Date.now() - cycleStartedAt;

    console.log(
      JSON.stringify({
        event: 'monitor-lives.cycle.complete',
        evaluatedLives: result.evaluatedLives,
        endedLives: result.endedLives.length,
        durationMs,
        intervalMs: pollIntervalMs,
      }),
    );

    return new Response(JSON.stringify({ success: true, data: { ...result, durationMs, intervalMs: pollIntervalMs } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'monitor-lives.cycle.error',
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
