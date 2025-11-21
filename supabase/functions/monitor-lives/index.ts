import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateLiveHeartbeats,
  type LiveHeartbeatSummaryLite,
  type LiveLifecycleStatus,
} from "../../../backend/src/shared/liveMonitorCore.ts";

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

const pollIntervalMs = Number(
  Deno.env.get('HEARTBEAT_INTERVAL_MS') ?? Deno.env.get('HEARTBEAT_INTERVAL') ?? '60000',
);
const toleranceMs = Number(
  Deno.env.get('HEARTBEAT_TOLERANCE_MS') ?? Deno.env.get('HEARTBEAT_TOLERANCE') ?? '600000',
);
const creditsPerInterval = Math.max(1, Math.round(pollIntervalMs / 1000));

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

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
  activeLives.forEach((live) => {
    const status = normalizeStatus(live.status);
    liveIdToStatus.set(live.id as string, status);
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
    .map((row) => {
      const liveId = row.live_id as string;
      const status = liveIdToStatus.get(liveId) ?? null;

      if (status === 'ended') {
        return null;
      }

      return {
        liveId,
        cameraActive: Boolean(row.camera_active),
        lastHeartbeat: row.last_heartbeat as string,
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
    const { error: logError } = await supabase.from('live_end_log').insert({
      live_id: liveId,
      creator_id: data.creator_id,
      reason,
      ended_at: endedAt,
    });

    if (logError) {
      throw new Error(`Failed to insert live end log: ${logError.message}`);
    }
  }

  const { error: cleanupError } = await supabase.from('live_heartbeat').delete().eq('live_id', liveId);

  if (cleanupError) {
    throw new Error(`Failed to cleanup heartbeat row: ${cleanupError.message}`);
  }
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
  const evaluation = evaluateLiveHeartbeats(summaries, Date.now(), {
    hostAbsentThresholdMs: toleranceMs,
    cameraInactiveThresholdMs: toleranceMs * 2,
  });
  const endedLives: { liveId: string; reason: string }[] = [];

  for (const candidate of evaluation.endedLives) {
    await transitionToEndingAndClose(candidate.liveId, candidate.reason, candidate.status);
    endedLives.push({ liveId: candidate.liveId, reason: candidate.reason });
  }

  await consumeViewerCredits(summaries);

  return {
    evaluatedLives: summaries.length,
    endedLives,
  };
};

const consumeViewerCredits = async (summaries: LiveHeartbeatSummaryLite[]) => {
  const allowedStatuses = new Set<LiveLifecycleStatus>(['waiting_for_host', 'live']);
  const liveIds = summaries.filter((summary) => allowedStatuses.has(summary.status ?? 'live')).map((summary) => summary.liveId);
  if (!liveIds.length) return;

  const { data, error } = await supabase
    .from('live_access')
    .select('id, user_id, live_id, credits_consumed, profiles!inner(credit_balance)')
    .in('live_id', liveIds);

  if (error) {
    console.error(JSON.stringify({ event: 'monitor-lives.credits.error', error: error.message }));
    return;
  }

  const rows = data ?? [];

  for (const row of rows) {
    const creditBalance = toNumber((row as any).profiles?.credit_balance, 0);
    const consumeAmount = Math.min(creditsPerInterval, creditBalance);
    if (consumeAmount <= 0) {
      continue;
    }

    await supabase.rpc('consume_credits', { p_user_id: row.user_id, p_amount: consumeAmount });
    const nextConsumed = toNumber(row.credits_consumed, 0) + consumeAmount;
    await supabase
      .from('live_access')
      .update({ credits_consumed: nextConsumed })
      .eq('id', row.id);
  }
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
