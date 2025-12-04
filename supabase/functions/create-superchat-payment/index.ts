import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPERCHAT_TIERS = {
  blue: { amount: 3, duration: 60 },
  yellow: { amount: 5, duration: 120 },
  red: { amount: 8, duration: 180 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, creatorId, roomId, tier, amount, duration, message } = await req.json();

    console.log('[create-superchat-payment] Request:', { userId, creatorId, roomId, tier, amount });

    if (!userId || !creatorId || !roomId || !tier || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tierConfig = SUPERCHAT_TIERS[tier as keyof typeof SUPERCHAT_TIERS];
    if (!tierConfig) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Mercado Pago preference
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      throw new Error('Missing Mercado Pago access token');
    }

    const externalReference = crypto.randomUUID();
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    const origin = req.headers.get('origin') || 'https://enacciilzvifhqpenhlz.lovableproject.com';

    const preference = {
      items: [
        {
          title: `SuperChat ${tier.charAt(0).toUpperCase() + tier.slice(1)} - Stream Live Hub`,
          quantity: 1,
          unit_price: tierConfig.amount,
          currency_id: 'BRL',
        },
      ],
      metadata: {
        event_type: 'SUPERCHAT',
        user_id: userId,
        creator_id: creatorId,
        room_id: roomId,
        tier: tier,
        duration: tierConfig.duration,
        message: message,
        payment_id: externalReference,
      },
      back_urls: {
        success: `${origin}/dashboard`,
        failure: `${origin}/dashboard`,
        pending: `${origin}/dashboard`,
      },
      auto_return: 'approved',
      external_reference: externalReference,
      notification_url: webhookUrl,
    };

    console.log('[create-superchat-payment] Creating MP preference:', { 
      amount: tierConfig.amount, 
      tier,
      duration: tierConfig.duration 
    });

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('[create-superchat-payment] MP error:', errorText);
      throw new Error(`Mercado Pago error: ${errorText}`);
    }

    const mpData = await mpResponse.json();
    console.log('[create-superchat-payment] MP preference created:', mpData.id);

    return new Response(JSON.stringify({
      init_point: mpData.init_point,
      preferenceId: mpData.id,
      paymentId: externalReference,
      amount: tierConfig.amount,
      tier,
      duration: tierConfig.duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[create-superchat-payment] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
