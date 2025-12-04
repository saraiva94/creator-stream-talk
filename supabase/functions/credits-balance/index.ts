import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or create credits wallet
    let { data: wallet, error: walletError } = await supabase
      .from('credits_wallet')
      .select('balance_credits')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError) {
      console.error('Error fetching wallet:', walletError);
      throw walletError;
    }

    // Create wallet if doesn't exist
    if (!wallet) {
      const { data: newWallet, error: createError } = await supabase
        .from('credits_wallet')
        .insert({ user_id: user.id, balance_credits: 0 })
        .select('balance_credits')
        .single();

      if (createError) {
        // Table might not exist, fallback to profiles.balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();

        return new Response(JSON.stringify({
          creditBalance: profile?.balance || 0,
          balance_credits: profile?.balance || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      wallet = newWallet;
    }

    const balance = wallet?.balance_credits || 0;
    // Estimate time: 180 credits = 30 minutes
    const estimatedMinutes = Math.floor((balance / 180) * 30);

    return new Response(JSON.stringify({
      creditBalance: balance,
      balance_credits: balance,
      estimated_time: estimatedMinutes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in credits-balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
