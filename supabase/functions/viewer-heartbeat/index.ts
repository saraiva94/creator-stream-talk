import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

interface HeartbeatRequest {
  liveId: string;
  sessionToken: string;
}

interface HeartbeatResponse {
  status: "OK" | "NO_CREDITS";
  secondsWatched: number;
  creditsConsumed: number;
  creditsChargedThisTick: number;
  ranOutOfCredits: boolean;
  remainingCredits: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client to verify token
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[viewer-heartbeat] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Parse request body
    const body: HeartbeatRequest = await req.json();
    const { liveId, sessionToken } = body;

    if (!liveId || !sessionToken) {
      return new Response(
        JSON.stringify({ error: "Missing liveId or sessionToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[viewer-heartbeat] Processing heartbeat for user ${userId}, live ${liveId}`);

    // Check if user has live access
    const { data: accessData } = await supabase
      .from("live_access")
      .select("id")
      .eq("user_id", userId)
      .eq("live_id", liveId)
      .maybeSingle();

    if (!accessData) {
      // Create access if not exists (user has credits)
      const { data: wallet } = await supabase
        .from("credits_wallet")
        .select("balance_credits")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (!wallet || wallet.balance_credits <= 0) {
        return new Response(
          JSON.stringify({
            status: "NO_CREDITS",
            secondsWatched: 0,
            creditsConsumed: 0,
            creditsChargedThisTick: 0,
            ranOutOfCredits: true,
            remainingCredits: 0,
          } as HeartbeatResponse),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create live_access entry
      await supabase.from("live_access").insert({
        user_id: userId,
        live_id: liveId,
        status: "active",
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Get or create consumption session
    const { data: session, error: sessionError } = await supabase
      .from("live_consumption")
      .select("id, live_id, user_id, session_token, seconds_watched, credits_consumed, started_at, ended_at, last_heartbeat_at")
      .eq("live_id", liveId)
      .eq("user_id", userId)
      .eq("session_token", sessionToken)
      .maybeSingle();

    let consumptionSession = session;

    if (sessionError) {
      console.error("[viewer-heartbeat] Error fetching session:", sessionError.message);
      throw new Error(`Failed to load live consumption session: ${sessionError.message}`);
    }

    if (!consumptionSession) {
      // Create new session
      const { data: inserted, error: insertError } = await supabase
        .from("live_consumption")
        .insert({
          live_id: liveId,
          user_id: userId,
          session_token: sessionToken,
          started_at: nowIso,
          last_heartbeat_at: nowIso,
          seconds_watched: 0,
          credits_consumed: 0,
        })
        .select("id, live_id, user_id, session_token, seconds_watched, credits_consumed, started_at, ended_at, last_heartbeat_at")
        .single();

      if (insertError || !inserted) {
        console.error("[viewer-heartbeat] Error creating session:", insertError?.message);
        throw new Error(`Failed to create live consumption session: ${insertError?.message ?? "unknown error"}`);
      }
      consumptionSession = inserted;
    }

    // Calculate elapsed time and credits
    const previousSeconds = consumptionSession.seconds_watched ?? 0;
    const previousCredits = consumptionSession.credits_consumed ?? 0;
    const lastHeartbeat = consumptionSession.last_heartbeat_at ?? consumptionSession.started_at ?? nowIso;

    const elapsedMs = Math.max(0, now.getTime() - new Date(lastHeartbeat).getTime());
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const newSecondsWatched = previousSeconds + elapsedSeconds;
    
    // 1 credit per 10 seconds (6 credits per minute)
    const totalCreditsShouldHaveBeenConsumed = Math.floor(newSecondsWatched / 10);
    const newCreditsToCharge = totalCreditsShouldHaveBeenConsumed - previousCredits;

    // If no credits to charge, just update the session
    if (newCreditsToCharge <= 0) {
      await supabase
        .from("live_consumption")
        .update({ seconds_watched: newSecondsWatched, last_heartbeat_at: nowIso })
        .eq("id", consumptionSession.id);

      // Get remaining credits
      const { data: walletData } = await supabase
        .from("credits_wallet")
        .select("balance_credits")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          status: "OK",
          secondsWatched: newSecondsWatched,
          creditsConsumed: previousCredits,
          creditsChargedThisTick: 0,
          ranOutOfCredits: false,
          remainingCredits: walletData?.balance_credits ?? 0,
        } as HeartbeatResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get wallet to check balance
    const { data: wallet, error: walletError } = await supabase
      .from("credits_wallet")
      .select("balance_credits")
      .or(`user_id.eq.${userId},profile_id.eq.${userId}`)
      .maybeSingle();

    if (walletError) {
      console.error("[viewer-heartbeat] Error fetching wallet:", walletError.message);
      throw new Error(`Failed to load credits wallet: ${walletError.message}`);
    }

    // Create wallet if not exists
    let currentBalance = wallet?.balance_credits ?? 0;
    if (!wallet) {
      const { error: createWalletError } = await supabase
        .from("credits_wallet")
        .insert({ user_id: userId, profile_id: userId, balance_credits: 0 });
      
      if (createWalletError) {
        console.error("[viewer-heartbeat] Error creating wallet:", createWalletError.message);
      }
      currentBalance = 0;
    }

    // If user has enough credits
    if (currentBalance >= newCreditsToCharge) {
      const nextBalance = currentBalance - newCreditsToCharge;

      // Deduct credits with optimistic locking
      const { error: updateWalletError } = await supabase
        .from("credits_wallet")
        .update({ balance_credits: nextBalance, updated_at: nowIso })
        .or(`user_id.eq.${userId},profile_id.eq.${userId}`)
        .eq("balance_credits", currentBalance);

      if (updateWalletError) {
        console.error("[viewer-heartbeat] Error updating wallet:", updateWalletError.message);
        throw new Error(`Failed to decrement wallet credits: ${updateWalletError.message}`);
      }

      // Update consumption session
      await supabase
        .from("live_consumption")
        .update({
          seconds_watched: newSecondsWatched,
          last_heartbeat_at: nowIso,
          credits_consumed: totalCreditsShouldHaveBeenConsumed,
        })
        .eq("id", consumptionSession.id);

      console.log(`[viewer-heartbeat] Charged ${newCreditsToCharge} credits. Remaining: ${nextBalance}`);

      return new Response(
        JSON.stringify({
          status: "OK",
          secondsWatched: newSecondsWatched,
          creditsConsumed: totalCreditsShouldHaveBeenConsumed,
          creditsChargedThisTick: newCreditsToCharge,
          ranOutOfCredits: false,
          remainingCredits: nextBalance,
        } as HeartbeatResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User ran out of credits - charge what we can
    const available = Math.max(0, currentBalance);
    const chargeableSeconds = available * 10;
    const cappedSecondsWatched = Math.min(newSecondsWatched, previousSeconds + chargeableSeconds);
    const creditsActuallyCharged = available;
    const nextCreditsConsumed = previousCredits + creditsActuallyCharged;

    // Zero the wallet
    const { error: zeroWalletError } = await supabase
      .from("credits_wallet")
      .update({ balance_credits: 0, updated_at: nowIso })
      .or(`user_id.eq.${userId},profile_id.eq.${userId}`);

    if (zeroWalletError) {
      console.error("[viewer-heartbeat] Error zeroing wallet:", zeroWalletError.message);
    }

    // Update and end consumption session
    await supabase
      .from("live_consumption")
      .update({
        seconds_watched: cappedSecondsWatched,
        last_heartbeat_at: nowIso,
        credits_consumed: nextCreditsConsumed,
        ended_at: nowIso,
      })
      .eq("id", consumptionSession.id);

    // Remove live access
    await supabase
      .from("live_access")
      .delete()
      .eq("live_id", liveId)
      .eq("user_id", userId);

    console.log(`[viewer-heartbeat] User ${userId} ran out of credits. Charged: ${creditsActuallyCharged}`);

    return new Response(
      JSON.stringify({
        status: "NO_CREDITS",
        secondsWatched: cappedSecondsWatched,
        creditsConsumed: nextCreditsConsumed,
        creditsChargedThisTick: creditsActuallyCharged,
        ranOutOfCredits: true,
        remainingCredits: 0,
      } as HeartbeatResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[viewer-heartbeat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
