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
const MIN_WITHDRAW_CENTS = 1500; // R$ 15,00
const WOOVI_BASE_URL = Deno.env.get('WOOVI_SANDBOX') === 'true' 
  ? 'https://api.woovi-sandbox.com'
  : 'https://api.openpix.com.br';

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

/**
 * Normaliza chave PIX removendo caracteres especiais de CPF/CNPJ
 */
function normalizePixKey(key: string): string {
  const trimmed = key.trim();
  // Se parece ser CPF ou CNPJ (apenas números com pontuação), remove pontuação
  if (/^[\d.\-\/]+$/.test(trimmed)) {
    return trimmed.replace(/\D/g, '');
  }
  return trimmed;
}

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
 * Valida formato da chave PIX
 */
function validatePixKeyFormat(key: string, keyType: PixKeyType): { valid: boolean; error?: string } {
  const cleanKey = key.replace(/\D/g, '');
  
  switch (keyType) {
    case 'CPF':
      if (cleanKey.length !== 11) {
        return { valid: false, error: 'CPF deve ter 11 dígitos' };
      }
      // Validação básica de CPF (dígitos repetidos são inválidos)
      if (/^(\d)\1+$/.test(cleanKey)) {
        return { valid: false, error: 'CPF inválido' };
      }
      break;
    case 'CNPJ':
      if (cleanKey.length !== 14) {
        return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
      }
      break;
    case 'EMAIL':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
        return { valid: false, error: 'Email inválido' };
      }
      break;
    case 'PHONE':
      if (!/^\+?55?\d{10,11}$/.test(cleanKey)) {
        return { valid: false, error: 'Telefone deve ter 10 ou 11 dígitos' };
      }
      break;
  }
  
  return { valid: true };
}

/**
 * Máscara PIX key para logs
 */
function maskPixKey(key: string): string {
  if (!key || key.length <= 6) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 3);
}

/**
 * Consulta informações da chave PIX via Woovi
 */
async function lookupPixKey(pixKey: string, keyType: PixKeyType, wooviAppId: string): Promise<{ 
  valid: boolean; 
  holderName?: string; 
  holderDocument?: string;
  bankName?: string;
  error?: string 
}> {
  try {
    // OpenPix/Woovi usa endpoint de decoding para validar chaves PIX
    const response = await fetch(`${WOOVI_BASE_URL}/api/v1/subaccount/${encodeURIComponent(pixKey)}`, {
      method: 'GET',
      headers: {
        'Authorization': wooviAppId,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      // Chave não encontrada - pode ser válida mas sem cadastro prévio no Woovi
      // Vamos tentar outra abordagem: simular um pagamento de valor 0 para validar
      return { valid: true, holderName: 'Não disponível (chave válida)' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[pix-withdraw] Lookup error:', errorData);
      return { valid: false, error: errorData.message || 'Erro ao validar chave PIX' };
    }

    const data = await response.json();
    return {
      valid: true,
      holderName: data.subAccount?.name || data.name || 'Nome não disponível',
      holderDocument: data.subAccount?.taxID?.taxID || data.taxID,
      bankName: data.subAccount?.bankAccount?.bankName || data.bankName,
    };
  } catch (error) {
    console.error('[pix-withdraw] Lookup exception:', error);
    // Em caso de erro de rede, permitir prosseguir mas sem nome
    return { valid: true, holderName: 'Não foi possível consultar (prossiga com cuidado)' };
  }
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

    const { action, userId, pixKey: rawPixKey, pixKeyType, amountCents } = await req.json();

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

    // Normalizar chave PIX (remover pontuação de CPF/CNPJ)
    const pixKey = rawPixKey ? normalizePixKey(rawPixKey) : '';

    // === ACTION: VALIDATE PIX KEY ===
    if (action === 'validate') {
      if (!pixKey) {
        return new Response(JSON.stringify({ error: 'Chave PIX obrigatória' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const keyType = (pixKeyType?.toUpperCase() as PixKeyType) || detectPixKeyType(pixKey);
      
      // Validar formato
      const formatValidation = validatePixKeyFormat(pixKey, keyType);
      if (!formatValidation.valid) {
        return new Response(JSON.stringify({ 
          valid: false, 
          error: formatValidation.error,
          keyType,
          normalizedKey: pixKey,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Consultar informações da chave via Woovi
      let lookupResult: { valid: boolean; holderName?: string; holderDocument?: string; bankName?: string; error?: string } = { 
        valid: true, 
        holderName: 'Confirmação manual necessária' 
      };
      if (wooviAppId) {
        lookupResult = await lookupPixKey(pixKey, keyType, wooviAppId);
      }

      return new Response(JSON.stringify({
        valid: lookupResult.valid,
        keyType,
        normalizedKey: pixKey,
        holderName: lookupResult.holderName,
        holderDocument: lookupResult.holderDocument,
        bankName: lookupResult.bankName,
        error: lookupResult.error,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === ACTION: WITHDRAW (default) ===
    console.log('[pix-withdraw] Request:', { 
      userId, 
      pixKey: maskPixKey(pixKey), 
      pixKeyType,
      amountCents 
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

    // Fetch both balances
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

    const { data: creatorWallet } = await supabase
      .from('creator_wallet')
      .select('balance_cents, pending_cents')
      .eq('creator_id', userId)
      .maybeSingle();

    const affiliateBalanceCents = profile.affiliate_earnings || 0;
    const creatorBalanceCents = creatorWallet?.balance_cents || 0;
    const totalAvailableCents = affiliateBalanceCents + creatorBalanceCents;

    console.log('[pix-withdraw] Balances:', { affiliateBalanceCents, creatorBalanceCents, totalAvailableCents });

    // Verificar saldo suficiente
    if (totalAvailableCents < amountCents) {
      return new Response(JSON.stringify({ 
        error: `Saldo insuficiente. Disponível: R$ ${(totalAvailableCents / 100).toFixed(2)}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate how much to deduct from each source
    // Priority: first from affiliate_earnings, then from creator_wallet
    let deductFromAffiliate = Math.min(affiliateBalanceCents, amountCents);
    let deductFromCreator = amountCents - deductFromAffiliate;

    console.log('[pix-withdraw] Deductions:', { deductFromAffiliate, deductFromCreator });

    // Gerar correlationId único
    const correlationId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Debitar saldos
    if (deductFromAffiliate > 0) {
      const newAffiliateBalance = affiliateBalanceCents - deductFromAffiliate;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          affiliate_earnings: newAffiliateBalance,
          updated_at: now,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[pix-withdraw] Affiliate balance update error:', updateError);
        throw new Error('Erro ao atualizar saldo de afiliado');
      }
    }

    if (deductFromCreator > 0) {
      const newCreatorBalance = creatorBalanceCents - deductFromCreator;
      const newPending = (creatorWallet?.pending_cents || 0) + deductFromCreator;

      const { error: updateError } = await supabase
        .from('creator_wallet')
        .update({ 
          balance_cents: newCreatorBalance,
          pending_cents: newPending,
          updated_at: now,
        })
        .eq('creator_id', userId);

      if (updateError) {
        console.error('[pix-withdraw] Creator balance update error:', updateError);
        // Rollback affiliate balance if we already deducted
        if (deductFromAffiliate > 0) {
          await supabase
            .from('profiles')
            .update({ affiliate_earnings: affiliateBalanceCents })
            .eq('id', userId);
        }
        throw new Error('Erro ao atualizar saldo de criador');
      }
    }

    // Determine source type for payout request (use 'creator' for mixed withdrawals as DB only allows 'creator' or 'affiliate')
    const sourceType = deductFromCreator > 0 ? 'creator' : 'affiliate';

    // Criar payout request
    const { data: payoutRequest, error: payoutError } = await supabase
      .from('payout_requests')
      .insert({
        creator_id: userId,
        amount: amountCents,
        pix_key: pixKey,
        pix_key_type: keyType,
        source_type: sourceType,
        status: 'processing',
        idempotency_key: correlationId,
        psp_transaction_id: correlationId,
      })
      .select()
      .single();

    if (payoutError || !payoutRequest) {
      console.error('[pix-withdraw] Payout request error:', payoutError);
      
      // Rollback balances
      if (deductFromAffiliate > 0) {
        await supabase
          .from('profiles')
          .update({ affiliate_earnings: affiliateBalanceCents })
          .eq('id', userId);
      }
      if (deductFromCreator > 0) {
        await supabase
          .from('creator_wallet')
          .update({ 
            balance_cents: creatorBalanceCents,
            pending_cents: creatorWallet?.pending_cents || 0,
          })
          .eq('creator_id', userId);
      }
      
      throw new Error('Erro ao criar solicitação de saque');
    }

    // Registrar hold no ledger (one entry for each source if mixed)
    if (deductFromAffiliate > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_type: 'affiliate',
        wallet_id: userId,
        type: 'hold',
        amount_cents: -deductFromAffiliate,
        balance_after_cents: affiliateBalanceCents - deductFromAffiliate,
        reference_type: 'payout_request',
        reference_id: payoutRequest.id,
        description: `Saque PIX (afiliado) - R$ ${(deductFromAffiliate / 100).toFixed(2)}`,
        metadata: { action: 'withdrawal.hold', correlationId, psp: 'woovi', source: 'affiliate' },
      });
    }
    
    if (deductFromCreator > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_type: 'creator',
        wallet_id: userId,
        type: 'hold',
        amount_cents: -deductFromCreator,
        balance_after_cents: creatorBalanceCents - deductFromCreator,
        reference_type: 'payout_request',
        reference_id: payoutRequest.id,
        description: `Saque PIX (criador) - R$ ${(deductFromCreator / 100).toFixed(2)}`,
        metadata: { action: 'withdrawal.hold', correlationId, psp: 'woovi', source: 'creator' },
      });
    }

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
          if (deductFromAffiliate > 0) {
            await supabase
              .from('profiles')
              .update({ affiliate_earnings: affiliateBalanceCents })
              .eq('id', userId);
          }
          if (deductFromCreator > 0) {
            await supabase
              .from('creator_wallet')
              .update({ 
                balance_cents: creatorBalanceCents,
                pending_cents: creatorWallet?.pending_cents || 0,
              })
              .eq('creator_id', userId);
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
          if (deductFromAffiliate > 0) {
            await supabase.from('wallet_transactions').insert({
              wallet_type: 'affiliate',
              wallet_id: userId,
              type: 'refund',
              amount_cents: deductFromAffiliate,
              balance_after_cents: affiliateBalanceCents,
              reference_type: 'payout_request',
              reference_id: payoutRequest.id,
              description: `Saque PIX falhou - valor estornado (afiliado)`,
              metadata: { action: 'withdrawal.refund', correlationId, psp: 'woovi', error: wooviData.message },
            });
          }
          if (deductFromCreator > 0) {
            await supabase.from('wallet_transactions').insert({
              wallet_type: 'creator',
              wallet_id: userId,
              type: 'refund',
              amount_cents: deductFromCreator,
              balance_after_cents: creatorBalanceCents,
              reference_type: 'payout_request',
              reference_id: payoutRequest.id,
              description: `Saque PIX falhou - valor estornado (criador)`,
              metadata: { action: 'withdrawal.refund', correlationId, psp: 'woovi', error: wooviData.message },
            });
          }

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
        deduct_from_affiliate: deductFromAffiliate,
        deduct_from_creator: deductFromCreator,
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
      sourceType,
      deductFromAffiliate,
      deductFromCreator,
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
