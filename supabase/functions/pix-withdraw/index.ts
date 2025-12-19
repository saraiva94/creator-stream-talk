/**
 * Edge Function: PIX Withdrawal via Woovi/OpenPix
 * 
 * Processa solicitações de saque PIX.
 * Se Woovi estiver configurado, processa automaticamente.
 * Caso contrário, cria solicitação para processamento manual.
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
 * Normaliza chave PIX ADICIONANDO formatação a CPF/CNPJ
 */
function normalizePixKey(key: string): string {
  const trimmed = key.trim();
  const cleanDigits = trimmed.replace(/\D/g, '');
  
  if (cleanDigits.length === 11) {
    return `${cleanDigits.slice(0, 3)}.${cleanDigits.slice(3, 6)}.${cleanDigits.slice(6, 9)}-${cleanDigits.slice(9, 11)}`;
  }
  
  if (cleanDigits.length === 14) {
    return `${cleanDigits.slice(0, 2)}.${cleanDigits.slice(2, 5)}.${cleanDigits.slice(5, 8)}/${cleanDigits.slice(8, 12)}-${cleanDigits.slice(12, 14)}`;
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
 * Verifica se o WOOVI_APP_ID está configurado corretamente
 */
function isWooviConfigured(appId: string | undefined): boolean {
  if (!appId) return false;
  // App ID da Woovi deve ter pelo menos 32 caracteres
  if (appId.length < 32) return false;
  // Verifica se não é um placeholder
  if (appId.includes('YOUR_') || appId.includes('your_') || appId === 'test') return false;
  return true;
}

/**
 * Tenta chamar a API Woovi para processar o PIX
 */
async function processWooviPayment(
  wooviAppId: string,
  pixKey: string,
  keyType: PixKeyType,
  amountCents: number,
  correlationId: string,
  payoutRequestId: string
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    console.log('[pix-withdraw] Calling Woovi API...', { 
      url: WOOVI_BASE_URL,
      appIdLength: wooviAppId.length,
      appIdPrefix: wooviAppId.substring(0, 8) + '...'
    });
    
    const wooviPayload = {
      value: amountCents,
      destinationAlias: pixKey,
      destinationAliasType: keyType,
      correlationID: correlationId,
      comment: `Saque Stream Live Hub - ${payoutRequestId.substring(0, 8)}`,
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
      
      // Extrair mensagem de erro mais específica
      let errorMessage = 'Erro ao processar PIX';
      if (wooviData.errors && Array.isArray(wooviData.errors)) {
        errorMessage = wooviData.errors.map((e: { message?: string }) => e.message).join(', ');
      } else if (wooviData.message) {
        errorMessage = wooviData.message;
      }
      
      return { success: false, error: errorMessage, data: wooviData };
    }

    console.log('[pix-withdraw] Woovi payment created:', {
      correlationId,
      status: wooviData.payment?.status,
    });

    return { success: true, data: wooviData };
  } catch (error) {
    console.error('[pix-withdraw] Woovi exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro de conexão com Woovi' 
    };
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
    const wooviEnabled = isWooviConfigured(wooviAppId);

    console.log('[pix-withdraw] Configuration:', { 
      wooviEnabled,
      wooviAppIdConfigured: !!wooviAppId,
    });

    // Require authentication
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

      return new Response(JSON.stringify({
        valid: true,
        keyType,
        normalizedKey: pixKey,
        holderName: 'Validação será confirmada no momento do envio',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === ACTION: WITHDRAW ===
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

    const keyType = (pixKeyType?.toUpperCase() as PixKeyType) || detectPixKeyType(pixKey);

    // Buscar saldos
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

    if (totalAvailableCents < amountCents) {
      return new Response(JSON.stringify({ 
        error: `Saldo insuficiente. Disponível: R$ ${(totalAvailableCents / 100).toFixed(2)}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calcular dedução de cada fonte
    let deductFromAffiliate = Math.min(affiliateBalanceCents, amountCents);
    let deductFromCreator = amountCents - deductFromAffiliate;

    console.log('[pix-withdraw] Deductions:', { deductFromAffiliate, deductFromCreator });

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
        if (deductFromAffiliate > 0) {
          await supabase
            .from('profiles')
            .update({ affiliate_earnings: affiliateBalanceCents })
            .eq('id', userId);
        }
        throw new Error('Erro ao atualizar saldo de criador');
      }
    }

    const sourceType = deductFromCreator > 0 ? 'creator' : 'affiliate';

    // Criar payout request - status 'pending' para processamento manual ou automático
    const { data: payoutRequest, error: payoutError } = await supabase
      .from('payout_requests')
      .insert({
        creator_id: userId,
        amount: amountCents,
        pix_key: pixKey,
        pix_key_type: keyType,
        source_type: sourceType,
        status: 'pending',
        idempotency_key: correlationId,
        psp_transaction_id: correlationId,
      })
      .select()
      .single();

    if (payoutError || !payoutRequest) {
      console.error('[pix-withdraw] Payout request error:', payoutError);
      
      // Rollback
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

    // Registrar hold no ledger
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
        metadata: { action: 'withdrawal.hold', correlationId, source: 'affiliate' },
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
        metadata: { action: 'withdrawal.hold', correlationId, source: 'creator' },
      });
    }

    // Tentar processar via Woovi se configurado
    let wooviProcessed = false;
    let wooviError: string | null = null;

    if (wooviEnabled && wooviAppId) {
      const wooviResult = await processWooviPayment(
        wooviAppId,
        pixKey,
        keyType,
        amountCents,
        correlationId,
        payoutRequest.id
      );

      if (wooviResult.success) {
        wooviProcessed = true;
        
        // Atualizar payout_request com resposta da Woovi
        await supabase
          .from('payout_requests')
          .update({
            psp_response: wooviResult.data,
            status: 'approved', // Woovi processou, marcar como aprovado
          })
          .eq('id', payoutRequest.id);
      } else {
        wooviError = wooviResult.error || 'Erro ao processar via Woovi';
        console.warn('[pix-withdraw] Woovi failed, falling back to manual processing:', wooviError);
        
        // Atualizar com erro mas não falhar - continuar para processamento manual
        await supabase
          .from('payout_requests')
          .update({
            psp_response: { error: wooviError, data: wooviResult.data },
            admin_notes: `Processamento automático falhou: ${wooviError}. Aguardando processamento manual.`,
          })
          .eq('id', payoutRequest.id);
      }
    } else {
      console.log('[pix-withdraw] Woovi not configured - payout requires manual processing');
    }

    // Registrar transação
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'pix_withdraw',
      amount: -(amountCents / 100),
      status: wooviProcessed ? 'processing' : 'pending',
      payment_method: 'pix',
      external_id: payoutRequest.id,
      metadata: { 
        pix_key_masked: maskPixKey(pixKey),
        pix_key_type: keyType,
        correlation_id: correlationId,
        woovi_processed: wooviProcessed,
        deduct_from_affiliate: deductFromAffiliate,
        deduct_from_creator: deductFromCreator,
      },
    });

    // Notificar usuário
    const userNotificationMessage = wooviProcessed
      ? `Seu saque de R$ ${(amountCents / 100).toFixed(2)} está sendo processado via PIX.`
      : `Seu saque de R$ ${(amountCents / 100).toFixed(2)} foi solicitado e será processado em breve.`;

    await supabase.from('notifications').insert({
      user_id: userId,
      title: wooviProcessed ? '💰 Saque PIX em processamento' : '📝 Saque solicitado',
      message: userNotificationMessage,
      type: 'withdrawal_processing',
    });

    // Notificar admins
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

      const adminMessage = wooviProcessed
        ? `${userProfile?.username || 'Usuário'} solicitou saque de R$ ${(amountCents / 100).toFixed(2)} via PIX (processado automaticamente)`
        : `${userProfile?.username || 'Usuário'} solicitou saque de R$ ${(amountCents / 100).toFixed(2)} via PIX - REQUER PROCESSAMENTO MANUAL`;

      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: wooviProcessed ? '🏦 Saque PIX processado' : '⚠️ Saque PIX pendente',
        message: adminMessage,
        type: 'withdrawal_requested',
      }));
      await supabase.from('notifications').insert(notifications);
    }

    console.log('[pix-withdraw] Withdrawal created:', { 
      payoutId: payoutRequest.id, 
      correlationId,
      amountCents, 
      sourceType,
      wooviProcessed,
      deductFromAffiliate,
      deductFromCreator,
    });

    return new Response(JSON.stringify({
      success: true,
      status: wooviProcessed ? 'processing' : 'pending',
      message: wooviProcessed 
        ? 'Saque PIX enviado para processamento automático'
        : 'Saque solicitado com sucesso. Será processado em até 24 horas.',
      payoutId: payoutRequest.id,
      correlationId,
      amount: amountCents / 100,
      automaticProcessing: wooviProcessed,
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
