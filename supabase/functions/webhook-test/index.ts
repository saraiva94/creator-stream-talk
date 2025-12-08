import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!mpToken) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test Mercado Pago API connection
    const mpResponse = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Erro ao conectar com Mercado Pago: ${mpResponse.status}`,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpUser = await mpResponse.json();

    // Get webhook configuration from Mercado Pago
    const webhookResponse = await fetch('https://api.mercadopago.com/v1/applications/search', {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });

    let webhookInfo = null;
    if (webhookResponse.ok) {
      webhookInfo = await webhookResponse.json();
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    return new Response(JSON.stringify({ 
      success: true,
      mercadoPagoConnected: true,
      accountInfo: {
        id: mpUser.id,
        email: mpUser.email,
        nickname: mpUser.nickname,
        first_name: mpUser.first_name,
        last_name: mpUser.last_name,
      },
      expectedWebhookUrl,
      webhookInfo,
      message: 'Conexão com Mercado Pago funcionando! Verifique se o webhook está configurado no painel do MP.',
      instructions: [
        '1. Acesse: https://www.mercadopago.com.br/developers/panel/app',
        '2. Clique na sua aplicação',
        '3. Vá em "Webhooks" ou "Notificações IPN"',
        `4. Configure a URL: ${expectedWebhookUrl}`,
        '5. Selecione eventos: "Pagamentos"',
        '6. Salve as alterações'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[webhook-test] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
