import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Threshold: end live if no heartbeat for 2 minutes
const HOST_ABSENT_THRESHOLD_MS = 2 * 60 * 1000;

const settleLiveEarnings = async (liveId: string, creatorId: string) => {
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

  const grossCents = Math.floor((totalCreditsConsumed * 500) / 180);
  const creatorCents = Math.floor((grossCents * 80) / 100);
  const platformCents = grossCents - creatorCents;

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

  const { data: wallet } = await supabase
    .from('creator_wallet')
    .select('balance_cents, total_earned_cents')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (wallet) {
    await supabase
      .from('creator_wallet')
      .update({ 
        balance_cents: (wallet.balance_cents || 0) + creatorCents,
        total_earned_cents: (wallet.total_earned_cents || 0) + creatorCents,
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

const endZombieLive = async (live: { id: string; creator_id: string }) => {
  const endedAt = new Date().toISOString();
  
  // End the live
  await supabase
    .from('lives')
    .update({ is_active: false, status: 'ended', ended_at: endedAt })
    .eq('id', live.id);

  // Update creator_profiles
  await supabase
    .from('creator_profiles')
    .update({ is_streaming: false })
    .eq('id', live.creator_id);

  // Update rooms if linked
  await supabase
    .from('rooms')
    .update({ is_active: false, ended_at: endedAt })
    .eq('creator_id', live.creator_id)
    .eq('is_active', true);

  // Settle earnings
  try {
    await settleLiveEarnings(live.id, live.creator_id);
  } catch (err) {
    console.error(`Failed to settle earnings for zombie live ${live.id}:`, err);
  }

  console.log(JSON.stringify({
    event: 'zombie_live.ended',
    liveId: live.id,
    creatorId: live.creator_id,
    endedAt,
  }));

  return live.id;
};

const runMonitorCycle = async () => {
  const now = Date.now();
  const thresholdTime = new Date(now - HOST_ABSENT_THRESHOLD_MS).toISOString();

  // Find zombie lives: active but no heartbeat in threshold
  const { data: zombieLives, error } = await supabase
    .from('lives')
    .select('id, creator_id, host_last_heartbeat')
    .eq('is_active', true)
    .or(`host_last_heartbeat.is.null,host_last_heartbeat.lt.${thresholdTime}`);

  if (error) {
    throw new Error(`Failed to query zombie lives: ${error.message}`);
  }

  const endedLives: string[] = [];

  for (const live of zombieLives ?? []) {
    try {
      await endZombieLive(live);
      endedLives.push(live.id);
    } catch (err) {
      console.error(`Failed to end zombie live ${live.id}:`, err);
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    foundZombies: zombieLives?.length ?? 0,
    endedLives,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(JSON.stringify({ event: 'monitor-lives.start', method: req.method }));

  try {
    const result = await runMonitorCycle();

    console.log(JSON.stringify({
      event: 'monitor-lives.complete',
      ...result,
    }));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'monitor-lives.error',
      error: error instanceof Error ? error.message : String(error),
    }));

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
