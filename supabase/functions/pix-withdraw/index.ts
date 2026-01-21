// supabase/functions/pix-withdraw/index.ts
// ATUALIZADO PARA VELANA.IO

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Velana credentials - SK (secret key) for Basic Auth, TK (transfer secret) for IP bypass
const VELANA_SK_LIVE = (Deno.env.get('VELANA_API_KEY') ?? '').trim();
const VELANA_TK_SECRET = (Deno.env.get('VELANA_TRANSFER_SECRET') ?? '').trim();
const VELANA_BASE_URL = 'https://api.velana.com.br';
const MIN_WITHDRAW_CENTS = 500; // R$ 5,00

// Fallback caso env var esteja truncada
const VELANA_TK_FALLBACK = 'tk_g7wdhc0u9tsp70w72wpr92win2a37tyq4asyx0qj';
const VELANA_SK_FALLBACK = 'sk_live_v2MNtp2Nr3zilgy7wnRDZln1qXbMZ3vjO4NUxylG3T';

// Use fallback if env vars are empty or wrong length
const getVelanaSK = () => (VELANA_SK_LIVE.length >= 40 ? VELANA_SK_LIVE : VELANA_SK_FALLBACK);
const getVelanaTK = () => (VELANA_TK_SECRET.length === 43 ? VELANA_TK_SECRET : VELANA_TK_FALLBACK);

// Helper para criar header de autenticação Basic (Velana usa Basic Auth)
function getVelanaAuthHeader(): string {
  // Velana espera: Basic base64(SK_LIVE:x)
  const credentials = `${getVelanaSK()}:x`;
  return `Basic ${btoa(credentials)}`;
}

interface PixWithdrawRequest {
  userId: string;
  pixKey: string;
  amountCents?: number;
  action?: 'validate' | 'withdraw';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Limpa chave PIX removendo formatação (pontos, traços, etc.)
 * Mantém @ e . para emails, + para telefones internacionais
 */
function cleanPixKey(pixKey: string, keyType: string): string {
  if (keyType === 'EMAIL') return pixKey.trim().toLowerCase();
  if (keyType === 'PHONE') return pixKey.replace(/[^+\d]/g, '');
  if (keyType === 'CPF' || keyType === 'CNPJ') return pixKey.replace(/\D/g, '');
  return pixKey.trim(); // RANDOM key - keep as is
}

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

/**
 * Tenta descobrir o IP de saída (egress) do runtime para whitelist na Velana.
 * (Melhor esforço — pode falhar dependendo de rede/CF.)
 */
async function getEgressIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.ip === 'string' ? data.ip : null;
  } catch {
    return null;
  }
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
    const { userId, pixKey, amountCents, action } = body;

    console.log('[pix-withdraw] Request:', { 
      userId, 
      pixKey: maskPixKey(pixKey), 
      amountCents,
      action: action || 'withdraw'
    });

    // 3.5. Handle validation action - just validate the PIX key without requiring amountCents
    if (action === 'validate') {
      if (!pixKey) {
        return new Response(JSON.stringify({ valid: false, error: 'Chave PIX obrigatória' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

       // Debug seguro: apenas confirma comprimento e se houve fallback
       const tkSecret = getVelanaTK();
       const skLive = getVelanaSK();
       const secretLength = tkSecret.length;
       const usedFallback = tkSecret === VELANA_TK_FALLBACK;
      
      const keyType = detectPixKeyType(pixKey);
      // For now, just return validation success with detected key type
      // In production, you could integrate with DICT to validate the key
      return new Response(JSON.stringify({ 
        valid: true, 
        keyType,
        normalizedKey: pixKey.trim(),
        holderName: 'Chave válida',
        secretLength,
        usedFallback,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 4. Validações básicas (for withdraw action)
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

    // 5. Busca saldos (afiliado + criador + legado)
    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliate_earnings, balance')
      .eq('id', userId)
      .single();

    const { data: creatorWallet } = await supabase
      .from('creator_wallet')
      .select('balance_cents, pending_cents')
      .eq('creator_id', userId)
      .maybeSingle();

    const affiliateBalance = profile?.affiliate_earnings || 0;
    const creatorBalance = creatorWallet?.balance_cents || 0;
    // Include legacy balance field (stored as decimal in R$, convert to cents)
    const legacyBalanceCents = Math.round((profile?.balance || 0) * 100);
    const totalAvailable = affiliateBalance + creatorBalance + legacyBalanceCents;

    console.log('[pix-withdraw] Balances:', { affiliateBalance, creatorBalance, legacyBalanceCents, totalAvailable });

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

    // 8. Debita saldos (prioriza afiliado, depois legado, depois criador)
    let remainingDebit = amountCents;
    let newAffiliateBalance = affiliateBalance;
    let newLegacyBalance = legacyBalanceCents;
    let newCreatorBalance = creatorBalance;
    let deductFromAffiliate = 0;
    let deductFromLegacy = 0;
    let deductFromCreator = 0;

    // First, deduct from affiliate earnings
    if (affiliateBalance > 0 && remainingDebit > 0) {
      deductFromAffiliate = Math.min(affiliateBalance, remainingDebit);
      newAffiliateBalance -= deductFromAffiliate;
      remainingDebit -= deductFromAffiliate;
    }

    // Second, deduct from legacy balance
    if (legacyBalanceCents > 0 && remainingDebit > 0) {
      deductFromLegacy = Math.min(legacyBalanceCents, remainingDebit);
      newLegacyBalance -= deductFromLegacy;
      remainingDebit -= deductFromLegacy;
    }

    // Finally, deduct from creator wallet
    if (remainingDebit > 0) {
      deductFromCreator = remainingDebit;
      newCreatorBalance -= remainingDebit;
    }

    console.log('[pix-withdraw] Deductions:', { deductFromAffiliate, deductFromLegacy, deductFromCreator });

    // 9. Atualiza saldos no banco
    if (deductFromAffiliate > 0 || deductFromLegacy > 0) {
      const profileUpdate: Record<string, number> = {};
      if (deductFromAffiliate > 0) {
        profileUpdate.affiliate_earnings = newAffiliateBalance;
      }
      if (deductFromLegacy > 0) {
        // Convert back to decimal for legacy balance field
        profileUpdate.balance = newLegacyBalance / 100;
      }
      await supabase
        .from('profiles')
        .update(profileUpdate)
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
      if (deductFromAffiliate > 0 || deductFromLegacy > 0) {
        const rollbackProfile: Record<string, number> = {};
        if (deductFromAffiliate > 0) {
          rollbackProfile.affiliate_earnings = affiliateBalance;
        }
        if (deductFromLegacy > 0) {
          rollbackProfile.balance = legacyBalanceCents / 100;
        }
        await supabase
          .from('profiles')
          .update(rollbackProfile)
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

    if (deductFromLegacy > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_type: 'legacy',
        wallet_id: userId,
        type: 'hold',
        amount_cents: -deductFromLegacy,
        balance_after_cents: newLegacyBalance,
        reference_type: 'payout_request',
        reference_id: payoutRequest.id,
        description: `Saque PIX (saldo legado) - R$ ${(deductFromLegacy / 100).toFixed(2)}`,
        metadata: { action: 'withdrawal.hold', correlationId, source: 'legacy' },
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

    // 13. Chama API Velana - POST /v1/transfers (endpoint correto para cash-out)
    let velanaProcessed = false;
    let velanaTransferId: string | null = null;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const postbackUrl = `${supabaseUrl}/functions/v1/velana-webhook`;
    
    // Get credentials with fallback
    const skLive = getVelanaSK();
    const tkSecret = getVelanaTK();
    
    console.log('[pix-withdraw] Checking Velana config...', { 
      hasApiKey: !!skLive, 
      skLength: skLive.length,
      tkLength: tkSecret.length,
      baseUrl: VELANA_BASE_URL,
      postbackUrl,
    });
    
    if (skLive) {
      const cleanedPixKey = cleanPixKey(pixKey, pixKeyType);
      console.log('[pix-withdraw] PIX key cleaned:', { original: maskPixKey(pixKey), cleaned: maskPixKey(cleanedPixKey), type: pixKeyType });

      try {
        // ✅ CHAMADA EXATAMENTE IGUAL AO POSTMAN
        // Auth: Basic base64(sk_live_xxx:x)
        // Body: { amount, pixKey, secret }
        const authHeader = `Basic ${btoa(`${skLive}:x`)}`;
        
        console.log('[pix-withdraw] Calling Velana POST /v1/transfers...', {
          url: `${VELANA_BASE_URL}/v1/transfers`,
          payload: { amount: amountCents, pixKey: maskPixKey(cleanedPixKey), secret: '***' },
          secretLength: tkSecret.length,
          skLength: skLive.length,
          usedTkFallback: tkSecret === VELANA_TK_FALLBACK,
          usedSkFallback: skLive === VELANA_SK_FALLBACK,
        });

        // Payload EXATAMENTE igual ao Postman - apenas amount, pixKey, secret
        const velanaResponse = await fetch(`${VELANA_BASE_URL}/v1/transfers`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountCents,
            pixKey: cleanedPixKey,
            secret: tkSecret,
          }),
        });

        const responseText = await velanaResponse.text();
        let velanaData: any;
        
        try {
          velanaData = JSON.parse(responseText);
        } catch {
          console.error('[pix-withdraw] Velana returned non-JSON:', responseText.substring(0, 200));
          velanaData = { error: 'Invalid JSON response', raw: responseText.substring(0, 200) };
        }
        
        console.log('[pix-withdraw] Velana response:', { 
          status: velanaResponse.status, 
          ok: velanaResponse.ok,
          data: velanaData 
        });

        // ⚠️ TRATAMENTO DE ERRO DE SEGURANÇA/IP (a Velana pode retornar 412/401/403)
        const velanaMessage =
          velanaData?.message || velanaData?.error || 'Erro de segurança/IP retornado pela Velana.';

        const isVelanaSecurityIpError =
          velanaResponse.status === 412 ||
          velanaResponse.status === 401 ||
          velanaResponse.status === 403 ||
          /ip\s+n[aã]o\s+autoriz/i.test(velanaMessage) ||
          /Configurações\s*->\s*Segurança/i.test(velanaMessage) ||
          /whitelist/i.test(velanaMessage);

        if (isVelanaSecurityIpError) {
          const egressIp = await getEgressIp();

          console.error('[pix-withdraw] ❌ Velana segurança/IP:', {
            status: velanaResponse.status,
            message: velanaMessage,
            egressIp: egressIp ?? 'unknown',
          });

          // Marca como rejected
          await supabase
            .from('payout_requests')
            .update({
              status: 'rejected',
              failure_reason: velanaMessage,
              psp_response: velanaData,
            })
            .eq('id', payoutRequest.id);

          // 🔄 DEVOLVE O SALDO DO USUÁRIO
          if (deductFromAffiliate > 0 || deductFromLegacy > 0) {
            const rollbackProfile: Record<string, number> = {};
            if (deductFromAffiliate > 0) {
              rollbackProfile.affiliate_earnings = affiliateBalance;
            }
            if (deductFromLegacy > 0) {
              rollbackProfile.balance = legacyBalanceCents / 100;
            }
            await supabase.from('profiles').update(rollbackProfile).eq('id', userId);
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

          // Retorna 412 + melhor pista possível para whitelist
          return new Response(
            JSON.stringify({
              success: false,
              error: velanaMessage,
              code: 'VELANA_PRECONDITION_FAILED',
              velanaStatus: velanaResponse.status,
              egressIp, // se vier preenchido, adicione este IP na whitelist da Velana
              details: egressIp
                ? `A Velana está exigindo whitelist de IP. Adicione este IP (egress) em Configurações → Segurança: ${egressIp}`
                : 'A Velana está exigindo whitelist de IP, mas não consegui detectar o IP de saída automaticamente. Gere um log/diagnóstico com o suporte da Velana para identificar o IP de origem do seu provedor serverless.',
            }),
            {
              status: 412,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        if (velanaResponse.ok && velanaData.id) {
          velanaProcessed = true;
          velanaTransferId = velanaData.id;
          
          // Mapeia status Velana para status interno
          // pending | bank_processing | success | failed
          let internalStatus = 'processing';
          if (velanaData.status === 'success') {
            internalStatus = 'paid';
          } else if (velanaData.status === 'failed') {
            internalStatus = 'rejected';
          } else if (velanaData.status === 'pending' || velanaData.status === 'bank_processing') {
            internalStatus = 'processing';
          }
          
          // Atualiza payout_request com dados da Velana
          await supabase
            .from('payout_requests')
            .update({
              status: internalStatus,
              approved_at: new Date().toISOString(),
              psp_transaction_id: velanaData.id,
              psp_response: velanaData,
            })
            .eq('id', payoutRequest.id);

          console.log('[pix-withdraw] Velana transfer created:', velanaData.id, 'status:', velanaData.status);
        } else {
          console.error('[pix-withdraw] Velana API error:', velanaData);
          
          // ⚠️ ERRO DA VELANA - DEVOLVE SALDO
          await supabase.from('payout_requests').update({
            status: 'rejected',
            failure_reason: velanaData.message || velanaData.error || JSON.stringify(velanaData),
            psp_response: velanaData,
          }).eq('id', payoutRequest.id);

          // Devolve saldo
          if (deductFromAffiliate > 0 || deductFromLegacy > 0) {
            const rollbackProfile: Record<string, number> = {};
            if (deductFromAffiliate > 0) {
              rollbackProfile.affiliate_earnings = affiliateBalance;
            }
            if (deductFromLegacy > 0) {
              rollbackProfile.balance = legacyBalanceCents / 100;
            }
            await supabase.from('profiles').update(rollbackProfile).eq('id', userId);
          }
          
          if (creatorWallet) {
            await supabase.from('creator_wallet').update({
              balance_cents: creatorBalance,
              pending_cents: creatorWallet.pending_cents || 0,
            }).eq('creator_id', userId);
          }

          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao processar saque: ${velanaData.message || 'Tente novamente mais tarde'}`,
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }
      } catch (velanaError) {
        console.error('[pix-withdraw] Velana fetch error:', velanaError);
        
        // Devolve saldo em caso de erro de conexão
        if (deductFromAffiliate > 0 || deductFromLegacy > 0) {
          const rollbackProfile: Record<string, number> = {};
          if (deductFromAffiliate > 0) {
            rollbackProfile.affiliate_earnings = affiliateBalance;
          }
          if (deductFromLegacy > 0) {
            rollbackProfile.balance = legacyBalanceCents / 100;
          }
          await supabase.from('profiles').update(rollbackProfile).eq('id', userId);
        }
        
        if (creatorWallet) {
          await supabase.from('creator_wallet').update({
            balance_cents: creatorBalance,
            pending_cents: creatorWallet.pending_cents || 0,
          }).eq('creator_id', userId);
        }
        
        await supabase.from('payout_requests').update({
          status: 'rejected',
          failure_reason: `Erro de conexão com API Velana: ${velanaError instanceof Error ? velanaError.message : 'Erro desconhecido'}`,
        }).eq('id', payoutRequest.id);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao conectar com o sistema de pagamentos. Tente novamente.',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    } else {
      console.log('[pix-withdraw] Velana not configured - payout requires manual processing');
      await supabase
        .from('payout_requests')
        .update({
          admin_notes: 'VELANA_API_KEY não configurada. Processamento manual necessário.',
        })
        .eq('id', payoutRequest.id);
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
        status: velanaProcessed ? 'processing' : 'pending',
        message: velanaProcessed 
          ? 'Saque enviado para processamento automático via PIX' 
          : 'Saque solicitado com sucesso. Aguarde processamento.',
        velanaProcessed,
        velanaTransferId,
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
