import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PIX withdrawal configuration - NO minimum, NO fees
const PLATFORM_FEE_PERCENT = 0;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, pixKey, pixKeyType, amountCents, isCreator } = await req.json();

    console.log('[pix-withdraw] Request:', { 
      userId, 
      pixKey: pixKey?.substring(0, 4) + '***', 
      pixKeyType,
      amountCents,
      isCreator 
    });

    // Validate required fields
    if (!userId || !pixKey || !amountCents) {
      return new Response(JSON.stringify({ 
        error: 'Campos obrigatórios: userId, pixKey, amountCents' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate amount is positive
    if (amountCents <= 0) {
      return new Response(JSON.stringify({ 
        error: 'O valor do saque deve ser maior que zero' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate PIX key type
    const validPixKeyTypes = ['cpf', 'cnpj', 'email', 'phone', 'random'];
    const keyType = pixKeyType || detectPixKeyType(pixKey);
    if (!validPixKeyTypes.includes(keyType)) {
      return new Response(JSON.stringify({ 
        error: 'Tipo de chave PIX inválido' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let availableBalanceCents = 0;
    let balanceSource = '';

    if (isCreator) {
      // Check creator wallet balance
      const { data: creatorWallet, error: walletError } = await supabase
        .from('creator_wallet')
        .select('balance_cents')
        .eq('creator_id', userId)
        .maybeSingle();

      if (walletError || !creatorWallet) {
        console.error('[pix-withdraw] Creator wallet not found:', walletError);
        return new Response(JSON.stringify({ 
          error: 'Carteira de criador não encontrada' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      availableBalanceCents = creatorWallet.balance_cents || 0;
      balanceSource = 'creator_wallet';
    } else {
      // Check affiliate balance (profiles.balance is in BRL, not cents)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        console.error('[pix-withdraw] Profile not found:', profileError);
        return new Response(JSON.stringify({ 
          error: 'Usuário não encontrado' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      availableBalanceCents = Math.round((profile.balance || 0) * 100);
      balanceSource = 'profiles';
    }

    // Check sufficient balance
    if (availableBalanceCents < amountCents) {
      return new Response(JSON.stringify({ 
        error: `Saldo insuficiente. Disponível: R$ ${(availableBalanceCents / 100).toFixed(2)}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate fees (currently 0%)
    const feeAmountCents = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100);
    const netAmountCents = amountCents - feeAmountCents;

    // Create payout request - AUTO-APPROVED and PAID immediately
    const payoutId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const { error: payoutError } = await supabase
      .from('payout_requests')
      .insert({
        id: payoutId,
        creator_id: userId,
        amount: amountCents / 100, // Store in BRL
        status: 'paid', // Auto-approved and marked as paid
        approved_at: now,
        paid_at: now,
        admin_notes: JSON.stringify({
          pix_key: pixKey,
          pix_key_type: keyType,
          gross_amount_cents: amountCents,
          fee_cents: feeAmountCents,
          net_amount_cents: netAmountCents,
          balance_source: balanceSource,
          requested_at: now,
          auto_approved: true,
          auto_approved_at: now,
        }),
      });

    if (payoutError) {
      console.error('[pix-withdraw] Payout request error:', payoutError);
      throw new Error('Erro ao criar solicitação de saque');
    }

    // Deduct from balance immediately (permanent deduction since auto-approved)
    if (isCreator) {
      const { error: updateError } = await supabase
        .from('creator_wallet')
        .update({ 
          balance_cents: availableBalanceCents - amountCents,
          // No pending_cents since it's auto-approved
        })
        .eq('creator_id', userId);

      if (updateError) {
        console.error('[pix-withdraw] Balance update error:', updateError);
        // Rollback payout request
        await supabase.from('payout_requests').delete().eq('id', payoutId);
        throw new Error('Erro ao atualizar saldo');
      }
    } else {
      const newBalanceBRL = (availableBalanceCents - amountCents) / 100;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newBalanceBRL })
        .eq('id', userId);

      if (updateError) {
        console.error('[pix-withdraw] Balance update error:', updateError);
        await supabase.from('payout_requests').delete().eq('id', payoutId);
        throw new Error('Erro ao atualizar saldo');
      }
    }

    // Record transaction as completed
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'pix_withdraw',
      amount: -(amountCents / 100),
      status: 'completed', // Auto-completed
      payment_method: 'pix',
      external_id: payoutId,
      metadata: { 
        pix_key_masked: pixKey.substring(0, 4) + '***',
        pix_key_type: keyType,
        fee_cents: feeAmountCents,
        net_cents: netAmountCents,
        auto_approved: true,
      },
    });

    // Notify user of successful withdrawal
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    await supabase.from('notifications').insert({
      user_id: userId,
      title: '💰 Saque PIX processado',
      message: `Seu saque de R$ ${(netAmountCents / 100).toFixed(2)} foi processado automaticamente.`,
      type: 'withdrawal_completed',
    });

    // Notify admins for record keeping
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: '🏦 Saque PIX auto-aprovado',
        message: `${userProfile?.username || 'Usuário'} sacou R$ ${(amountCents / 100).toFixed(2)} (auto-aprovado)`,
        type: 'withdrawal_auto_approved',
      }));
      await supabase.from('notifications').insert(notifications);
      console.log('[pix-withdraw] Admin notifications sent');
    }

    console.log('[pix-withdraw] Auto-approved and completed:', { 
      payoutId, 
      amountCents, 
      netAmountCents,
      balanceSource 
    });

    return new Response(JSON.stringify({
      success: true,
      status: 'completed',
      message: 'Saque processado automaticamente com sucesso!',
      payoutId,
      amount: amountCents / 100,
      fee: feeAmountCents / 100,
      netAmount: netAmountCents / 100,
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

// Helper function to detect PIX key type
function detectPixKeyType(key: string): string {
  // CPF: 11 digits
  if (/^\d{11}$/.test(key.replace(/\D/g, '')) && key.replace(/\D/g, '').length === 11) {
    return 'cpf';
  }
  // CNPJ: 14 digits
  if (/^\d{14}$/.test(key.replace(/\D/g, '')) && key.replace(/\D/g, '').length === 14) {
    return 'cnpj';
  }
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    return 'email';
  }
  // Phone: +55 followed by digits
  if (/^\+?55?\d{10,11}$/.test(key.replace(/\D/g, ''))) {
    return 'phone';
  }
  // Random key (UUID format)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)) {
    return 'random';
  }
  return 'random'; // Default
}
