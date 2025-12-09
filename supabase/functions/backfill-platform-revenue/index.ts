import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Registration price and commission structure
const REGISTRATION_PRICE = 5.00;
const DIRECT_COMMISSION = 1.00;
const ROOT_COMMISSION = 0.50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[backfill] Starting platform revenue backfill...');

    // Find all profiles that are active but don't have corresponding platform_revenue entries
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, referrer_direct, referrer_root, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    console.log('[backfill] Found profiles:', profiles?.length);

    // Get existing platform_revenue entries to avoid duplicates
    const { data: existingRevenue } = await supabase
      .from('platform_revenue')
      .select('user_id');

    const existingUserIds = new Set((existingRevenue || []).map((r: any) => r.user_id));

    // Get existing transactions to avoid duplicates
    const { data: existingTransactions } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('type', 'registration');

    const existingTransactionUserIds = new Set((existingTransactions || []).map((t: any) => t.user_id));

    let processed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const profile of profiles || []) {
      // Skip if already has platform_revenue entry
      if (existingUserIds.has(profile.id)) {
        console.log('[backfill] Skipping (already has revenue):', profile.username);
        skipped++;
        continue;
      }

      // Skip the original founding accounts (they might be free registrations)
      // These are typically the first accounts created
      if (profile.username === 'suami' || profile.username === 'sir.saraiva94' || profile.username === 'Jhonatan silvere') {
        console.log('[backfill] Skipping founding account:', profile.username);
        skipped++;
        continue;
      }

      const directId = profile.referrer_direct;
      const rootId = profile.referrer_root;

      // Calculate platform amount (after commissions)
      let platformAmountCents = Math.round(REGISTRATION_PRICE * 100); // 500 centavos

      if (directId) {
        platformAmountCents -= Math.round(DIRECT_COMMISSION * 100); // -100 = 400

        // Pay direct commission
        await supabase.rpc('increment_affiliate_earnings', {
          p_profile_id: directId,
          p_amount_cents: Math.round(DIRECT_COMMISSION * 100),
        });
        console.log('[backfill] Direct commission paid to:', directId);

        if (rootId && rootId !== directId) {
          platformAmountCents -= Math.round(ROOT_COMMISSION * 100); // -50 = 350
          
          await supabase.rpc('increment_affiliate_earnings', {
            p_profile_id: rootId,
            p_amount_cents: Math.round(ROOT_COMMISSION * 100),
          });
          console.log('[backfill] Root commission paid to:', rootId);
        }
      }

      const externalRef = `backfill_${profile.id}`;

      // Insert platform_revenue
      await supabase.from('platform_revenue').insert({
        source_type: 'registration',
        source_id: externalRef,
        amount: platformAmountCents,
        user_id: profile.id,
        metadata: { 
          backfill: true,
          direct_id: directId, 
          root_id: rootId, 
          gross_amount: Math.round(REGISTRATION_PRICE * 100),
          backfill_date: new Date().toISOString(),
        },
      });

      // Insert transaction if not exists
      if (!existingTransactionUserIds.has(profile.id)) {
        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'registration',
          amount: REGISTRATION_PRICE,
          platform_amount: platformAmountCents / 100,
          status: 'completed',
          external_id: externalRef,
          metadata: { backfill: true, direct_id: directId, root_id: rootId },
        });
      }

      console.log('[backfill] Processed:', profile.username, 'Platform revenue:', platformAmountCents);
      
      results.push({
        username: profile.username,
        platformAmountCents,
        directId,
        rootId,
      });
      
      processed++;
    }

    console.log('[backfill] Completed. Processed:', processed, 'Skipped:', skipped);

    return new Response(JSON.stringify({
      success: true,
      processed,
      skipped,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[backfill] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
