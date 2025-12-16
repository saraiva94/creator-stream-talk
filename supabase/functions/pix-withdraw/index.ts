/**
 * Edge Function: PIX Withdrawal via Woovi/OpenPix
 * 
 * Processa solicitações de saque PIX usando Woovi como PSP.
 * Validações, débito de saldo, e chamada à API Woovi.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações
const MIN_WITHDRAW_CENTS = 2000; // R$ 20,00
const WOOVI_BASE_URL = Deno.env.get('WOOVI_SANDBOX') === 'true' 
  ? 'https://api.woovi-sandbox.com'
  : 'https://api.openpix.com.br';

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

/**
 * Detecta tipo de chave PIX automaticamente
 */
function detectPixKeyType(key: string): PixKeyType {
  const cleanKey = key.replace(/\D/g, '');
  
  if (/^\d{11}$/.test(cleanKey)) return 'CPF';
  if (/^\d{14}$/.test(cleanKey)) return 'CNPJ';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return 'EMAIL';
  if (/^\+?55?\d{10,11}$/.test(cleanKey)) return 'PHONE';
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)) return 'RANDOM';
  
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const wooviAppId = Deno.env.get('WOOVI_APP_ID');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Require authentication and ensure caller can only act on their own userId
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, pixKey, pixKeyType, amountCents, isCreator } = await req.json();

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('[pix-withdraw] Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[pix-withdraw] Request:', { 
      userId, 
      pixKey: maskPixKey(pixKey), 
      pixKeyType,
      amountCents,
      isCreator 
    });

    // Validar campos obrigatórios
    if (!userId || !pixKey || !amountCents) {
      return new Response(JSON.stringify({ 
        error: 'Campos obrigatórios: userId, pixKey, amountCents' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validar valor mínimo
    if (amountCents < MIN_WITHDRAW_CENTS) {
      return new Response(JSON.stringify({ 
        error: `Valor mínimo para saque é de R$ ${(MIN_WITHDRAW_CENTS / 100).toFixed(2)}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detectar tipo de chave PIX
    const keyType = (pixKeyType?.toUpperCase() as PixKeyType) || detectPixKeyType(pixKey);

    let availableBalanceCents = 0;
    let balanceSource = '';

    if (isCreator) {
      const { data: creatorWallet, error: walletError } = await supabase
        .from('creator_wallet')
        .select('balance_cents, pending_cents')
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('affiliate_earnings')
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

      availableBalanceCents = profile.affiliate_earnings || 0;
      balanceSource = 'profiles';
    }

    // Verificar saldo suficiente
    if (availableBalanceCents < amountCents) {
      return new Response(JSON.stringify({ 
        error: `Saldo insuficiente. Disponível: R$ ${(availableBalanceCents / 100).toFixed(2)}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gerar correlationId único
    const correlationId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Debitar saldo e criar payout_request
    if (isCreator) {
      const { data: wallet } = await supabase
        .from('creator_wallet')
        .select('balance_cents, pending_cents')
        .eq('creator_id', userId)
        .single();

      const newBalance = (wallet?.balance_cents || 0) - amountCents;
      const newPending = (wallet?.pending_cents || 0) + amountCents;

      const { error: updateError } = await supabase
        .from('creator_wallet')
        .update({ 
          balance_cents: newBalance,
          pending_cents: newPending,
          updated_at: now,
        })
        .eq('creator_id', userId);

      if (updateError) {
        console.error('[pix-withdraw] Balance update error:', updateError);
        throw new Error('Erro ao atualizar saldo');
      }
    } else {
      const newBalanceCents = availableBalanceCents - amountCents;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          affiliate_earnings: newBalanceCents,
          updated_at: now,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[pix-withdraw] Balance update error:', updateError);
        throw new Error('Erro ao atualizar saldo');
      }
    }

    // Criar payout request
    const { data: payoutRequest, error: payoutError } = await supabase
      .from('payout_requests')
      .insert({
        creator_id: userId,
        amount: amountCents,
        pix_key: pixKey,
        pix_key_type: keyType,
        source_type: isCreator ? 'creator' : 'affiliate',
        status: 'processing',
        idempotency_key: correlationId,
        psp_transaction_id: correlationId,
      })
      .select()
      .single();

    if (payoutError || !payoutRequest) {
      console.error('[pix-withdraw] Payout request error:', payoutError);
      
      // Rollback balance
      if (isCreator) {
        const { data: wallet } = await supabase
          .from('creator_wallet')
          .select('balance_cents, pending_cents')
          .eq('creator_id', userId)
          .single();

        await supabase
          .from('creator_wallet')
          .update({ 
            balance_cents: (wallet?.balance_cents || 0) + amountCents,
            pending_cents: Math.max(0, (wallet?.pending_cents || 0) - amountCents),
          })
          .eq('creator_id', userId);
      } else {
        await supabase
          .from('profiles')
          .update({ affiliate_earnings: availableBalanceCents })
          .eq('id', userId);
      }
      
      throw new Error('Erro ao criar solicitação de saque');
    }

    // Registrar hold no ledger
    const walletType = isCreator ? 'creator' : 'affiliate';
    await supabase.from('wallet_transactions').insert({
      wallet_type: walletType,
      wallet_id: userId,
      type: 'hold',
      amount_cents: -amountCents,
      balance_after_cents: availableBalanceCents - amountCents,
      reference_type: 'payout_request',
      reference_id: payoutRequest.id,
      description: `Saque PIX em processamento - R$ ${(amountCents / 100).toFixed(2)}`,
      metadata: { action: 'withdrawal.hold', correlationId, psp: 'woovi' },
    });

    // Chamar API da Woovi para criar pagamento PIX
    if (wooviAppId) {
      try {
        console.log('[pix-withdraw] Calling Woovi API...');
        
        const wooviPayload = {
          value: amountCents,
          destinationAlias: pixKey,
          destinationAliasType: keyType,
          correlationID: correlationId,
          comment: `Saque Stream Live Hub - ${payoutRequest.id.substring(0, 8)}`,
        };

        const wooviResponse = await fetch(`${WOOVI_BASE_URL}/api/v1/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': wooviAppId,
          },
          body: JSON.stringify(wooviPayload),
        });

        const wooviData = await wooviResponse.json();

        if (!wooviResponse.ok) {
          console.error('[pix-withdraw] Woovi API error:', wooviData);
          
          // Rollback everything
          if (isCreator) {
            const { data: wallet } = await supabase
              .from('creator_wallet')
              .select('balance_cents, pending_cents')
              .eq('creator_id', userId)
              .single();

            await supabase
              .from('creator_wallet')
              .update({ 
                balance_cents: (wallet?.balance_cents || 0) + amountCents,
                pending_cents: Math.max(0, (wallet?.pending_cents || 0) - amountCents),
              })
              .eq('creator_id', userId);
          } else {
            await supabase
              .from('profiles')
              .update({ affiliate_earnings: availableBalanceCents })
              .eq('id', userId);
          }

          await supabase
            .from('payout_requests')
            .update({ 
              status: 'failed', 
              failure_reason: wooviData.message || 'Erro na API Woovi',
              psp_response: wooviData,
            })
            .eq('id', payoutRequest.id);

          // Record refund in ledger
          await supabase.from('wallet_transactions').insert({
            wallet_type: walletType,
            wallet_id: userId,
            type: 'refund',
            amount_cents: amountCents,
            balance_after_cents: availableBalanceCents,
            reference_type: 'payout_request',
            reference_id: payoutRequest.id,
            description: `Saque PIX falhou - valor estornado`,
            metadata: { action: 'withdrawal.refund', correlationId, psp: 'woovi', error: wooviData.message },
          });

          throw new Error(wooviData.message || 'Erro ao processar PIX via Woovi');
        }

        // Atualizar payout_request com resposta da Woovi
        await supabase
          .from('payout_requests')
          .update({
            psp_response: wooviData,
          })
          .eq('id', payoutRequest.id);

        console.log('[pix-withdraw] Woovi payment created:', {
          correlationId,
          status: wooviData.payment?.status,
        });

      } catch (wooviError) {
        console.error('[pix-withdraw] Woovi error:', wooviError);
        throw wooviError;
      }
    } else {
      console.warn('[pix-withdraw] WOOVI_APP_ID not configured - payout will require manual processing');
    }

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'pix_withdraw',
      amount: -(amountCents / 100),
      status: 'processing',
      payment_method: 'pix',
      external_id: payoutRequest.id,
      metadata: { 
        pix_key_masked: maskPixKey(pixKey),
        pix_key_type: keyType,
        correlation_id: correlationId,
        psp: 'woovi',
      },
    });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '💰 Saque PIX em processamento',
      message: `Seu saque de R$ ${(amountCents / 100).toFixed(2)} está sendo processado via PIX.`,
      type: 'withdrawal_processing',
    });

    // Notify admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: '🏦 Saque PIX solicitado',
        message: `${userProfile?.username || 'Usuário'} solicitou saque de R$ ${(amountCents / 100).toFixed(2)} via PIX`,
        type: 'withdrawal_requested',
      }));
      await supabase.from('notifications').insert(notifications);
    }

    console.log('[pix-withdraw] Withdrawal created:', { 
      payoutId: payoutRequest.id, 
      correlationId,
      amountCents, 
      balanceSource 
    });

    return new Response(JSON.stringify({
      success: true,
      status: 'processing',
      message: 'Saque PIX enviado para processamento',
      payoutId: payoutRequest.id,
      correlationId,
      amount: amountCents / 100,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[pix-withdraw] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
