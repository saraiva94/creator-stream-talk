import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Registration price and commission structure (in BRL)
const REGISTRATION_PRICE_CENTS = 700; // R$7.00
const DIRECT_COMMISSION_CENTS = 100;  // R$1.00
const ROOT_COMMISSION_CENTS = 50;     // R$0.50

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[backfill] Starting platform revenue backfill...');

    // Parse request body for options
    let options: { 
      processAll?: boolean; 
      userIds?: string[];
      dryRun?: boolean;
    } = {};
    
    try {
      const body = await req.text();
      if (body) {
        options = JSON.parse(body);
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const { dryRun = false } = options;

    // Define founding accounts that should not be processed for paid registration
    const foundingUsernames = ['suami', 'sir.saraiva94', 'Jhonatan silvere'];

    // Find all profiles that are active
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, referrer_direct, referrer_root, referrer_id, referrer_parent_id, status, created_at, affiliate_earnings')
      .eq('status', 'active')
      .order('created_at', { ascending: true }); // Process oldest first

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    console.log('[backfill] Found active profiles:', profiles?.length);

    // Get existing platform_revenue entries to avoid duplicates
    const { data: existingRevenue } = await supabase
      .from('platform_revenue')
      .select('user_id, source_id');

    const existingRevenueUserIds = new Set((existingRevenue || []).map((r: { user_id: string }) => r.user_id));

    // Get existing transactions to avoid duplicates
    const { data: existingTransactions } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('type', 'registration');

    const existingTransactionUserIds = new Set((existingTransactions || []).map((t: { user_id: string }) => t.user_id));

    // Get existing affiliate_logs
    const { data: existingAffiliateLogs } = await supabase
      .from('affiliate_logs')
      .select('new_user');

    const existingAffiliateLogUsers = new Set((existingAffiliateLogs || []).map((l: { new_user: string }) => l.new_user));

    // Build referral code to user ID map for resolving referrers
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, referral_code, referrer_direct, referrer_root');

    const referralCodeToUserId = new Map<string, string>();
    const userIdToParent = new Map<string, string | null>();
    
    for (const p of allProfiles || []) {
      if (p.referral_code) {
        referralCodeToUserId.set(p.referral_code.toUpperCase(), p.id);
      }
      userIdToParent.set(p.id, p.referrer_direct || p.referrer_root || null);
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const results: Array<{
      username: string;
      userId: string;
      action: string;
      directId: string | null;
      rootId: string | null;
      directCommission: number;
      rootCommission: number;
      platformRevenue: number;
    }> = [];

    for (const profile of profiles || []) {
      try {
        // Skip founding accounts
        if (foundingUsernames.includes(profile.username)) {
          console.log('[backfill] Skipping founding account:', profile.username);
          skipped++;
          continue;
        }

        // Skip if already has platform_revenue entry
        if (existingRevenueUserIds.has(profile.id)) {
          console.log('[backfill] Skipping (already has revenue):', profile.username);
          skipped++;
          continue;
        }

        // Determine referrer IDs
        let directId = profile.referrer_direct || profile.referrer_id || null;
        let rootId = profile.referrer_root || profile.referrer_parent_id || null;

        // If rootId is same as directId, try to find the grandparent
        if (rootId === directId && directId) {
          rootId = userIdToParent.get(directId) || null;
        }

        // Calculate platform amount (after commissions)
        let platformAmountCents = REGISTRATION_PRICE_CENTS;
        let directCommissionPaid = 0;
        let rootCommissionPaid = 0;

        if (directId) {
          platformAmountCents -= DIRECT_COMMISSION_CENTS;
          directCommissionPaid = DIRECT_COMMISSION_CENTS;
        }

        if (rootId && rootId !== directId) {
          platformAmountCents -= ROOT_COMMISSION_CENTS;
          rootCommissionPaid = ROOT_COMMISSION_CENTS;
        }

        const externalRef = `backfill_${profile.id}_${Date.now()}`;

        if (!dryRun) {
          // Pay direct commission
          if (directId && directCommissionPaid > 0) {
            const { error: directError } = await supabase.rpc('increment_affiliate_earnings', {
              p_profile_id: directId,
              p_amount_cents: directCommissionPaid,
            });
            
            if (directError) {
              console.error('[backfill] Failed to pay direct commission:', directError);
            } else {
              console.log('[backfill] Direct commission paid:', directId, directCommissionPaid);
            }
          }

          // Pay root commission
          if (rootId && rootId !== directId && rootCommissionPaid > 0) {
            const { error: rootError } = await supabase.rpc('increment_affiliate_earnings', {
              p_profile_id: rootId,
              p_amount_cents: rootCommissionPaid,
            });
            
            if (rootError) {
              console.error('[backfill] Failed to pay root commission:', rootError);
            } else {
              console.log('[backfill] Root commission paid:', rootId, rootCommissionPaid);
            }
          }

          // Insert platform_revenue
          const { error: revenueError } = await supabase.from('platform_revenue').insert({
            source_type: 'registration',
            source_id: externalRef,
            amount: platformAmountCents,
            user_id: profile.id,
            metadata: { 
              backfill: true,
              direct_id: directId, 
              root_id: rootId, 
              gross_amount: REGISTRATION_PRICE_CENTS,
              direct_commission: directCommissionPaid,
              root_commission: rootCommissionPaid,
              backfill_date: new Date().toISOString(),
            },
          });

          if (revenueError) {
            console.error('[backfill] Failed to insert platform_revenue:', revenueError);
          }

          // Insert transaction if not exists
          if (!existingTransactionUserIds.has(profile.id)) {
            const { error: txError } = await supabase.from('transactions').insert({
              user_id: profile.id,
              type: 'registration',
              amount: REGISTRATION_PRICE_CENTS / 100,
              platform_amount: platformAmountCents / 100,
              status: 'completed',
              external_id: externalRef,
              metadata: { backfill: true, direct_id: directId, root_id: rootId },
            });

            if (txError) {
              console.error('[backfill] Failed to insert transaction:', txError);
            }
          }

          // Insert affiliate_log if not exists and has referrer
          if (!existingAffiliateLogUsers.has(profile.id) && directId) {
            const { error: logError } = await supabase.from('affiliate_logs').insert({
              new_user: profile.id,
              direct_referrer: directId,
              root_creator: rootId !== directId ? rootId : null,
              amount_direct: directCommissionPaid,
              amount_root: rootCommissionPaid,
              amount_platform: platformAmountCents,
              event_type: 'REGISTRATION',
              payment_id: externalRef,
            });

            if (logError) {
              console.error('[backfill] Failed to insert affiliate_log:', logError);
            }
          }
        }

        console.log('[backfill] Processed:', profile.username, {
          directId,
          rootId,
          directCommission: directCommissionPaid,
          rootCommission: rootCommissionPaid,
          platformRevenue: platformAmountCents,
          dryRun,
        });

        results.push({
          username: profile.username,
          userId: profile.id,
          action: dryRun ? 'would_process' : 'processed',
          directId,
          rootId,
          directCommission: directCommissionPaid,
          rootCommission: rootCommissionPaid,
          platformRevenue: platformAmountCents,
        });

        processed++;
      } catch (profileError) {
        console.error('[backfill] Error processing profile:', profile.username, profileError);
        errors++;
      }
    }

    console.log('[backfill] Completed. Processed:', processed, 'Skipped:', skipped, 'Errors:', errors);

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      processed,
      skipped,
      errors,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[backfill] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
