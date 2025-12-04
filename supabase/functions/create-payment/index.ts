import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Credit packages: credits -> price in BRL
const CREDIT_PACKAGES: Record<number, number> = {
  180: 5.00,    // 30 min
  360: 9.00,    // 1 hour
  720: 16.00,   // 2 hours
  1800: 35.00,  // 5 hours
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, purchaseType, credits, liveId, amount, description } = await req.json();

    console.log('[create-payment] Request:', { userId, purchaseType, credits, liveId, amount });

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine payment amount
    let paymentAmount = amount;
    let paymentDescription = description;
    let creditsToGrant = credits || 0;

    if (purchaseType === 'credits' || purchaseType === 'CREDITS_PURCHASE') {
      if (!credits || !CREDIT_PACKAGES[credits]) {
        // Default to 180 credits if not specified
        creditsToGrant = credits || 180;
        paymentAmount = CREDIT_PACKAGES[creditsToGrant] || 5.00;
      } else {
        paymentAmount = CREDIT_PACKAGES[credits];
      }
      paymentDescription = `${creditsToGrant} créditos - Stream Live Hub`;
    } else if (purchaseType === 'live_access' && liveId) {
      // Get live price
      const { data: live } = await supabase
        .from('lives')
        .select('price, title')
        .eq('id', liveId)
        .single();

      paymentAmount = live?.price || amount || 5.00;
      paymentDescription = `Acesso: ${live?.title || 'Live'}`;
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid payment amount' }), {
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

    const eventType = purchaseType === 'credits' || purchaseType === 'CREDITS_PURCHASE' 
      ? 'CREDITS_PURCHASE' 
      : 'LIVE_ACCESS';

    const preference = {
      items: [
        {
          title: paymentDescription || 'Compra - Stream Live Hub',
          quantity: 1,
          unit_price: paymentAmount,
          currency_id: 'BRL',
        },
      ],
      metadata: {
        event_type: eventType,
        user_id: userId,
        live_id: liveId || null,
        credits: creditsToGrant,
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

    console.log('[create-payment] Creating MP preference:', { 
      amount: paymentAmount, 
      credits: creditsToGrant,
      eventType 
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
      console.error('[create-payment] MP error:', errorText);
      throw new Error(`Mercado Pago error: ${errorText}`);
    }

    const mpData = await mpResponse.json();
    console.log('[create-payment] MP preference created:', mpData.id);

    return new Response(JSON.stringify({
      init_point: mpData.init_point,
      preferenceId: mpData.id,
      paymentId: externalReference,
      amount: paymentAmount,
      credits: creditsToGrant,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[create-payment] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
