// supabase/functions/pix-withdraw/index.ts
// ATUALIZADO PARA VELANA.IO

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VELANA_API_KEY = Deno.env.get('VELANA_API_KEY');
const VELANA_BASE_URL = 'https://api.velana.io';
const MIN_WITHDRAW_CENTS = 1000; // R$ 10,00

interface PixWithdrawRequest {
  userId: string;
  pixKey: string;
  amountCents: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Detecta tipo de chave PIX automaticamente
 */
function detectPixKeyType(pixKey: string): string {
  const cleanKey = pixKey.replace(/\D/g, '');

  if (/^\d{11}$/.test(cleanKey)) return 'CPF';
  if (/^\d{14}$/.test(cleanKey)) return 'CNPJ';
  if (/@/.test(pixKey)) return 'EMAIL';
  if (/^\+?\d{10,13}$/.test(cleanKey)) return 'PHONE';
  return 'RANDOM';
}

/**
 * Máscara PIX key para logs
 */
function maskPixKey(key: string): string {
  if (!key || key.length <= 6) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 3);
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Valida autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autenticação necessária' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. Valida token e pega usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 3. Parse do body
    const body: PixWithdrawRequest = await req.json();
    const { userId, pixKey, amountCents } = body;

    console.log('[pix-withdraw] Request:', { 
      userId, 
      pixKey: maskPixKey(pixKey), 
      amountCents 
    });

    // 4. Validações básicas
    if (!pixKey || !amountCents) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Usuário inválido' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (amountCents < MIN_WITHDRAW_CENTS) {
      return new Response(
        JSON.stringify({ error: `Valor mínimo: R$ ${(MIN_WITHDRAW_CENTS / 100).toFixed(2)}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 5. Busca saldos (afiliado + criador)
    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliate_earnings')
      .eq('id', userId)
      .single();

    const { data: creatorWallet } = await supabase
      .from('creator_wallet')
      .select('balance_cents, pending_cents')
      .eq('creator_id', userId)
      .maybeSingle();

    const affiliateBalance = profile?.affiliate_earnings || 0;
    const creatorBalance = creatorWallet?.balance_cents || 0;
    const totalAvailable = affiliateBalance + creatorBalance;

    console.log('[pix-withdraw] Balances:', { affiliateBalance, creatorBalance, totalAvailable });

    // 6. Valida saldo suficiente
    if (totalAvailable < amountCents) {
      return new Response(
        JSON.stringify({
          error: `Saldo insuficiente. Disponível: R$ ${(totalAvailable / 100).toFixed(2)}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 7. Gera ID único (correlationId)
    const correlationId = crypto.randomUUID();

    // 8. Debita saldos (prioriza afiliado, depois criador)
    let remainingDebit = amountCents;
    let newAffiliateBalance = affiliateBalance;
    let newCreatorBalance = creatorBalance;
    let deductFromAffiliate = 0;
    let deductFromCreator = 0;

    if (affiliateBalance > 0) {
      deductFromAffiliate = Math.min(affiliateBalance, remainingDebit);
      newAffiliateBalance -= deductFromAffiliate;
      remainingDebit -= deductFromAffiliate;
    }

    if (remainingDebit > 0) {
      deductFromCreator = remainingDebit;
      newCreatorBalance -= remainingDebit;
    }

    console.log('[pix-withdraw] Deductions:', { deductFromAffiliate, deductFromCreator });

    // 9. Atualiza saldos no banco
    if (deductFromAffiliate > 0) {
      await supabase
        .from('profiles')
        .update({ affiliate_earnings: newAffiliateBalance })
        .eq('id', userId);
    }

    if (creatorWallet) {
      await supabase
        .from('creator_wallet')
        .update({
          balance_cents: newCreatorBalance,
          pending_cents: (creatorWallet.pending_cents || 0) + amountCents,
        })
        .eq('creator_id', userId);
    }

    // 10. Detecta tipo de chave PIX
    const pixKeyType = detectPixKeyType(pixKey);
    const sourceType = deductFromCreator > 0 ? 'creator' : 'affiliate';

    // 11. Cria registro de payout_request
    const { data: payoutRequest, error: insertError } = await supabase
      .from('payout_requests')
      .insert({
        creator_id: userId,
        amount: amountCents / 100, // Converte para decimal
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        source_type: sourceType,
        status: 'pending',
        idempotency_key: correlationId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[pix-withdraw] Erro ao criar payout_request:', insertError);
      
      // Rollback saldos
      if (deductFromAffiliate > 0) {
        await supabase
          .from('profiles')
          .update({ affiliate_earnings: affiliateBalance })
          .eq('id', userId);
      }
      if (creatorWallet) {
        await supabase
          .from('creator_wallet')
          .update({ 
            balance_cents: creatorBalance,
            pending_cents: creatorWallet.pending_cents || 0,
          })
          .eq('creator_id', userId);
      }
      
      return new Response(JSON.stringify({ error: 'Falha ao registrar saque' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 12. Registrar hold no ledger
    if (deductFromAffiliate > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_type: 'affiliate',
        wallet_id: userId,
        type: 'hold',
        amount_cents: -deductFromAffiliate,
        balance_after_cents: newAffiliateBalance,
        reference_type: 'payout_request',
        reference_id: payoutRequest.id,
        description: `Saque PIX (afiliado) - R$ ${(deductFromAffiliate / 100).toFixed(2)}`,
        metadata: { action: 'withdrawal.hold', correlationId, source: 'affiliate' },
      });
    }
    
    if (deductFromCreator > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_type: 'creator',
        wallet_id: userId,
        type: 'hold',
        amount_cents: -deductFromCreator,
        balance_after_cents: newCreatorBalance,
        reference_type: 'payout_request',
        reference_id: payoutRequest.id,
        description: `Saque PIX (criador) - R$ ${(deductFromCreator / 100).toFixed(2)}`,
        metadata: { action: 'withdrawal.hold', correlationId, source: 'creator' },
      });
    }

    // 13. Chama API Velana
    let velanaProcessed = false;
    
    if (VELANA_API_KEY) {
      const amountBRL = (amountCents / 100).toFixed(2);

      const velanaPayload = {
        amount: parseFloat(amountBRL),
        pixKey: pixKey,
        pixKeyType: pixKeyType,
        description: 'Saque Stream Live Hub',
        externalId: correlationId,
      };

      try {
        console.log('[pix-withdraw] Calling Velana API...');
        
        const velanaResponse = await fetch(`${VELANA_BASE_URL}/v1/pix/transfers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VELANA_API_KEY}`,
          },
          body: JSON.stringify(velanaPayload),
        });

        const velanaData = await velanaResponse.json();

        if (velanaResponse.ok) {
          velanaProcessed = true;
          
          // Atualiza payout_request com dados da Velana
          await supabase
            .from('payout_requests')
            .update({
              status: 'approved',
              psp_transaction_id: velanaData.id,
              psp_response: velanaData,
            })
            .eq('id', payoutRequest.id);

          console.log('[pix-withdraw] Velana transfer created:', velanaData.id);
        } else {
          console.error('[pix-withdraw] Velana API error:', velanaData);
          await supabase
            .from('payout_requests')
            .update({
              admin_notes: `Processamento automático falhou: ${velanaData.message || 'Erro na API Velana'}. Aguardando processamento manual.`,
              psp_response: velanaData,
            })
            .eq('id', payoutRequest.id);
        }
      } catch (velanaError) {
        console.error('[pix-withdraw] Velana fetch error:', velanaError);
        // Mantém status pending para retry manual
      }
    } else {
      console.log('[pix-withdraw] Velana not configured - payout requires manual processing');
    }

    // 14. Registrar transação
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'pix_withdraw',
      amount: amountCents,
      status: 'pending',
      payment_method: 'pix',
      metadata: {
        payout_request_id: payoutRequest.id,
        pix_key: maskPixKey(pixKey),
        pix_key_type: pixKeyType,
        correlation_id: correlationId,
        velana_processed: velanaProcessed,
      },
    });

    // 15. Notificações
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '📤 Saque solicitado',
      message: `Sua solicitação de saque de R$ ${(amountCents / 100).toFixed(2)} foi recebida e está sendo processada.`,
      type: 'withdrawal',
    });

    // Notificar admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map((admin) => ({
        user_id: admin.user_id,
        title: '💰 Nova solicitação de saque',
        message: `Novo saque de R$ ${(amountCents / 100).toFixed(2)} aguardando processamento.`,
        type: 'admin_withdrawal',
      }));

      await supabase.from('notifications').insert(adminNotifications);
    }

    // 16. Resposta de sucesso
    return new Response(
      JSON.stringify({
        success: true,
        payoutId: payoutRequest.id,
        status: velanaProcessed ? 'approved' : 'pending',
        message: velanaProcessed 
          ? 'Saque processado automaticamente' 
          : 'Saque solicitado com sucesso. Aguarde processamento.',
        velanaProcessed,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('[pix-withdraw] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
