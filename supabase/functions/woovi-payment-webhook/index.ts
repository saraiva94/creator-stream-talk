/**
 * Edge Function: Woovi/OpenPix Payment Webhook
 * 
 * Recebe notificações da Woovi sobre o status dos pagamentos PIX (saques).
 * Atualiza o status do payout_request e ajusta o ledger conforme necessário.
 * 
 * Eventos esperados:
 * - OPENPIX:MOVEMENT_CONFIRMED: Pagamento PIX confirmado
 * - OPENPIX:MOVEMENT_FAILED: Pagamento PIX falhou
 * 
 * URL: https://[PROJECT_ID].supabase.co/functions/v1/woovi-payment-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

/**
 * Máscara chave PIX para logs
 */
function maskPixKey(pixKey: string): string {
  if (!pixKey || pixKey.length <= 6) return '***';
  return `${pixKey.substring(0, 3)}***${pixKey.substring(pixKey.length - 3)}`;
}

/**
 * Valida assinatura do webhook da Woovi
 * 
 * A Woovi pode usar HMAC-SHA256 com o payload bruto
 */
function validateWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = Deno.env.get('WOOVI_WEBHOOK_SECRET');
  
  if (!webhookSecret) {
    console.warn('[woovi-webhook] WOOVI_WEBHOOK_SECRET not configured, skipping validation');
    return true; // Em desenvolvimento, aceita sem validação
  }

  try {
    // Woovi usa HMAC-SHA256
    const hmac = createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    const isValid = expectedSignature === signature;
    
    if (!isValid) {
      console.warn('[woovi-webhook] Signature mismatch', {
        expected: expectedSignature.substring(0, 10) + '...',
        received: signature.substring(0, 10) + '...',
      });
    }
    
    return isValid;
  } catch (error) {
    console.error('[woovi-webhook] Error validating signature:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Apenas aceitar POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Ler payload
    const payloadText = await req.text();
    const signature = req.headers.get('x-webhook-signature') || '';

    console.log('[woovi-webhook] Received webhook', {
      signature: signature ? 'present' : 'missing',
      contentLength: payloadText.length,
    });

    // Validar assinatura (apenas log, sempre retorna 200)
    if (!validateWebhookSignature(payloadText, signature)) {
      console.warn('[woovi-webhook] Assinatura inválida - aceitando mesmo assim para registro do webhook', { 
        signatureHeader: signature ? signature.substring(0, 10) + '...' : 'missing' 
      });
    }

    // Parsear payload
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      console.warn('[woovi-webhook] Invalid JSON payload - retornando ok mesmo assim');
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    /**
     * Formato esperado do webhook da Woovi (PIX Out):
     * 
     * Sucesso:
     * {
     *   "event": "OPENPIX:MOVEMENT_CONFIRMED",
     *   "payment": {
     *     "value": 3000,
     *     "status": "CONFIRMED",
     *     "destinationAlias": "chave_pix",
     *     "comment": "",
     *     "correlationID": "uuid-do-saque"
     *   },
     *   "transaction": {
     *     "value": 3000,
     *     "endToEndId": "E2311...",
     *     "time": "2023-03-16T12:42:47.526Z"
     *   }
     * }
     * 
     * Falha:
     * {
     *   "event": "OPENPIX:MOVEMENT_FAILED",
     *   "payment": {
     *     "value": 3000,
     *     "status": "FAILED",
     *     "destinationAlias": "chave_pix",
     *     "comment": "",
     *     "correlationID": "uuid-do-saque"
     *   },
     *   "error": {
     *     "code": "PAY_PIX_KEY_ERROR",
     *     "description": "Falha ao Pagar Chave Pix"
     *   }
     * }
     */

    const event = payload.event;
    const paymentData = payload.payment;
    const transactionData = payload.transaction;
    const errorData = payload.error;

    const correlationId = paymentData?.correlationID;
    const status = paymentData?.status;
    const e2eId = transactionData?.endToEndId;
    const failureReason = errorData?.description || payload.failureReason;

    if (!correlationId) {
      console.warn('[woovi-webhook] Notification without correlationID, skipping', payload);
      return new Response(
        JSON.stringify({ received: true, skipped: 'no correlationID' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[woovi-webhook] Processing notification', {
      event,
      correlationId,
      status,
      e2eId,
    });

    // Buscar payout_request pelo correlationId
    const { data: payout, error: fetchError } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .or(`psp_transaction_id.eq.${correlationId},idempotency_key.eq.${correlationId}`)
      .maybeSingle();

    if (fetchError) {
      console.error('[woovi-webhook] Error fetching payout', { error: fetchError, correlationId });
      return new Response(
        JSON.stringify({ received: true, error: 'Database error' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payout) {
      console.warn('[woovi-webhook] Payout not found for correlationId', { correlationId });
      return new Response(
        JSON.stringify({ received: true, skipped: 'payout not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar idempotência - se já está em estado final
    if (payout.status === 'paid' || payout.status === 'failed') {
      console.log('[woovi-webhook] Payout already in final state (idempotent)', {
        payoutId: payout.id,
        status: payout.status,
      });
      return new Response(
        JSON.stringify({ received: true, status: payout.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const walletType = payout.source_type === 'creator' ? 'creator' : 'affiliate';

    // Processar evento de SUCESSO
    if (event === 'OPENPIX:MOVEMENT_CONFIRMED' || status === 'CONFIRMED') {
      console.log('[woovi-webhook] Processing SUCCESS', { payoutId: payout.id, correlationId });

      // Atualizar payout para paid
      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          psp_response: payload,
        })
        .eq('id', payout.id);

      // Zerar pending do creator
      if (payout.source_type === 'creator') {
        const { data: wallet } = await supabaseAdmin
          .from('creator_wallet')
          .select('pending_cents')
          .eq('creator_id', payout.creator_id)
          .single();

        const newPending = Math.max(0, (wallet?.pending_cents || 0) - payout.amount);

        await supabaseAdmin
          .from('creator_wallet')
          .update({
            pending_cents: newPending,
            updated_at: new Date().toISOString(),
          })
          .eq('creator_id', payout.creator_id);
      }

      // Registrar release no ledger
      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_type: walletType,
        wallet_id: payout.creator_id,
        type: 'release',
        amount_cents: payout.amount,
        balance_after_cents: 0,
        reference_type: 'payout_request',
        reference_id: payout.id,
        description: `Saque PIX confirmado - R$ ${(payout.amount / 100).toFixed(2)}`,
        metadata: { action: 'withdrawal.release', e2eId, correlationId, psp: 'woovi' },
      });

      // Atualizar transação
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'completed' })
        .eq('external_id', payout.id);

      // Notificar usuário
      await supabaseAdmin.from('notifications').insert({
        user_id: payout.creator_id,
        type: 'withdrawal',
        title: 'Saque concluído!',
        message: `Seu saque de R$ ${(payout.amount / 100).toFixed(2)} foi depositado via PIX.`,
      });

      console.log('[woovi-webhook] Payout marked as PAID', { payoutId: payout.id });
    }
    // Processar evento de FALHA
    else if (event === 'OPENPIX:MOVEMENT_FAILED' || status === 'FAILED') {
      console.log('[woovi-webhook] Processing FAILURE', { payoutId: payout.id, correlationId, reason: failureReason });

      // Obter saldo atual para restaurar
      let currentBalance = 0;
      if (payout.source_type === 'creator') {
        const { data: wallet } = await supabaseAdmin
          .from('creator_wallet')
          .select('balance_cents, pending_cents')
          .eq('creator_id', payout.creator_id)
          .single();

        currentBalance = wallet?.balance_cents || 0;
        const newBalance = currentBalance + payout.amount;
        const newPending = Math.max(0, (wallet?.pending_cents || 0) - payout.amount);

        // Devolver saldo
        await supabaseAdmin
          .from('creator_wallet')
          .update({
            balance_cents: newBalance,
            pending_cents: newPending,
            updated_at: new Date().toISOString(),
          })
          .eq('creator_id', payout.creator_id);

        currentBalance = newBalance;
      } else {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('affiliate_earnings')
          .eq('id', payout.creator_id)
          .single();

        currentBalance = profile?.affiliate_earnings || 0;
        const newBalance = currentBalance + payout.amount;

        // Devolver saldo
        await supabaseAdmin
          .from('profiles')
          .update({
            affiliate_earnings: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payout.creator_id);

        currentBalance = newBalance;
      }

      // Atualizar payout para failed
      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: failureReason || 'Pagamento rejeitado pelo banco',
          psp_response: payload,
        })
        .eq('id', payout.id);

      // Registrar refund no ledger
      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_type: walletType,
        wallet_id: payout.creator_id,
        type: 'refund',
        amount_cents: payout.amount,
        balance_after_cents: currentBalance,
        reference_type: 'payout_request',
        reference_id: payout.id,
        description: `Saque PIX estornado - R$ ${(payout.amount / 100).toFixed(2)} - Motivo: ${failureReason || 'Rejeitado'}`,
        metadata: { action: 'withdrawal.refund', reason: failureReason, correlationId, psp: 'woovi' },
      });

      // Atualizar transação
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'failed' })
        .eq('external_id', payout.id);

      // Notificar usuário
      await supabaseAdmin.from('notifications').insert({
        user_id: payout.creator_id,
        type: 'withdrawal',
        title: 'Saque falhou',
        message: `Seu saque de R$ ${(payout.amount / 100).toFixed(2)} não pôde ser processado. O valor foi devolvido ao seu saldo. Motivo: ${failureReason || 'Rejeitado pelo banco'}`,
      });

      console.log('[woovi-webhook] Payout marked as FAILED, balance refunded', { payoutId: payout.id });
    }
    // Status desconhecido
    else {
      console.warn('[woovi-webhook] Unknown event/status received', { event, status, correlationId });
    }

    // Registrar log do webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'woovi_pix',
      event_type: event || 'pix_disbursement',
      status: 'processed',
      payload: payload,
      processed_at: new Date().toISOString(),
    });

    // Sempre retornar 200 para evitar retentativas desnecessárias
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[woovi-webhook] Unexpected error:', error);
    
    // Retornar 200 mesmo com erro para evitar loop de retentativas
    return new Response(
      JSON.stringify({ received: true, error: 'Internal processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
