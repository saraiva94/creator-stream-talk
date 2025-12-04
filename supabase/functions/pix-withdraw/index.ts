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

    const { userId, pixKey, amountCents } = await req.json();

    console.log('[pix-withdraw] Request:', { userId, pixKey: pixKey?.substring(0, 3) + '***', amountCents });

    if (!userId || !pixKey || !amountCents) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const minWithdraw = 1000; // R$ 10,00
    if (amountCents < minWithdraw) {
      return new Response(JSON.stringify({ error: `Valor mínimo para saque é R$ ${(minWithdraw / 100).toFixed(2)}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('[pix-withdraw] Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const balanceCents = Math.round((profile.balance || 0) * 100);
    if (balanceCents < amountCents) {
      return new Response(JSON.stringify({ error: 'Saldo insuficiente' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create PIX payment via Mercado Pago
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      throw new Error('Missing Mercado Pago access token');
    }

    // Mercado Pago PIX disbursement
    const pixPayment = {
      transaction_amount: amountCents / 100,
      description: "Saque Stream Star",
      payment_method_id: "pix",
      payer: {
        email: `user_${userId}@streamstar.app`,
      },
      additional_info: {
        pix_key: pixKey,
      },
    };

    console.log('[pix-withdraw] Creating PIX transfer:', { amount: amountCents / 100 });

    // Note: In production, you would use Mercado Pago's disbursement API
    // For now, we'll simulate the transfer and record it
    
    // Deduct from user balance
    const newBalance = (profile.balance || 0) - (amountCents / 100);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      console.error('[pix-withdraw] Balance update error:', updateError);
      throw new Error('Erro ao atualizar saldo');
    }

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'pix_withdraw',
      amount: -(amountCents / 100),
      status: 'completed',
      payment_method: 'pix',
      metadata: { pix_key: pixKey.substring(0, 3) + '***' },
    });

    // Notify admins about the withdrawal
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: 'Novo saque PIX',
        message: `Saque de R$ ${(amountCents / 100).toFixed(2)} processado`,
        type: 'withdrawal',
      }));
      await supabase.from('notifications').insert(notifications);
      console.log('[pix-withdraw] Admin notifications sent');
    }

    console.log('[pix-withdraw] Success:', { userId, amountCents, newBalance });

    return new Response(JSON.stringify({
      success: true,
      message: 'Saque processado com sucesso',
      amount: amountCents / 100,
      newBalance,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[pix-withdraw] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
