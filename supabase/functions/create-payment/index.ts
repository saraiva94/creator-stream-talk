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

    const { creatorId, userId, type, amount, description } = await req.json();

    // Get financial settings
    const { data: settings } = await supabase
      .from('financial_settings')
      .select('subscription_price')
      .single();

    const paymentAmount = amount || settings?.subscription_price || 5.00;

    // Create Mercado Pago preference
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
    
    const preference = {
      items: [
        {
          title: description || 'Assinatura Premium',
          quantity: 1,
          unit_price: paymentAmount,
          currency_id: 'BRL'
        }
      ],
      back_urls: {
        success: `${req.headers.get('origin')}/dashboard`,
        failure: `${req.headers.get('origin')}/subscribe`,
        pending: `${req.headers.get('origin')}/subscribe`
      },
      auto_return: 'approved',
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      metadata: {
        user_id: userId,
        creator_id: creatorId,
        type: type || 'subscription'
      }
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    console.log('Mercado Pago preference created:', data);

    return new Response(JSON.stringify({
      init_point: data.init_point,
      preference_id: data.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
