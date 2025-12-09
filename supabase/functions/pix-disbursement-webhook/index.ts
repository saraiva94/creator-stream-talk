/**
 * Edge Function: PIX Disbursement Webhook
 * 
 * Recebe notificações da Efí sobre o status dos pagamentos PIX.
 * Atualiza o status do payout_request e ajusta o ledger conforme necessário.
 * 
 * IMPORTANTE:
 * - Configure a URL deste webhook no painel da Efí
 * - URL: https://[PROJECT_ID].supabase.co/functions/v1/pix-disbursement-webhook
 * - Configure EFI_WEBHOOK_SECRET para validação de assinatura
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
 * Valida assinatura do webhook da Efí
 * 
 * TODO: Implementar validação conforme documentação da Efí
 * https://dev.efipay.com.br/docs/api-pix/webhooks
 */
function validateWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = Deno.env.get('EFI_WEBHOOK_SECRET');
  
  if (!webhookSecret) {
    console.warn('[pix-webhook] EFI_WEBHOOK_SECRET not configured, skipping validation');
    return true; // Em desenvolvimento, aceita sem validação
  }

  // TODO: Implementar HMAC-SHA256 ou método usado pela Efí
  // const expectedSignature = crypto.createHmac('sha256', webhookSecret)
  //   .update(payload)
  //   .digest('hex');
  // return expectedSignature === signature;
  
  return true;
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

    console.log('[pix-webhook] Received webhook', {
      signature: signature ? 'present' : 'missing',
      contentLength: payloadText.length,
    });

    // Validar assinatura
    if (!validateWebhookSignature(payloadText, signature)) {
      console.error('[pix-webhook] Invalid signature');
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    // Parsear payload
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      console.error('[pix-webhook] Invalid JSON payload');
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    /**
     * Formato esperado do webhook da Efí (exemplo):
     * {
     *   "pix": [{
     *     "endToEndId": "E09089356202205051234abcdefghijk",
     *     "txid": "fc9a43k6f647w478c5e369d541edab56",
     *     "chave": "11999999999",
     *     "valor": "100.00",
     *     "horario": "2022-05-05T15:30:00.000Z",
     *     "infoPagador": "Pagamento",
     *     "status": "CONCLUIDA" | "REJEITADA" | "ERRO"
     *   }]
     * }
     * 
     * IMPORTANTE: Verifique a documentação oficial da Efí para o formato correto
     * https://dev.efipay.com.br/docs/api-pix/webhooks
     */

    // Processar cada notificação PIX
    const pixNotifications = payload.pix || [payload];

    for (const pixData of pixNotifications) {
      const txid = pixData.txid || pixData.pspTransactionId || pixData.transactionId;
      const status = pixData.status || pixData.paymentStatus;
      const e2eId = pixData.endToEndId || pixData.e2eId;
      const failureReason = pixData.motivo || pixData.failureReason || pixData.errorMessage;

      if (!txid) {
        console.warn('[pix-webhook] Notification without txid, skipping', pixData);
        continue;
      }

      console.log('[pix-webhook] Processing notification', {
        txid,
        status,
        e2eId,
      });

      // Buscar payout_request pelo psp_transaction_id
      const { data: payout, error: fetchError } = await supabaseAdmin
        .from('payout_requests')
        .select('*')
        .eq('psp_transaction_id', txid)
        .maybeSingle();

      if (fetchError) {
        console.error('[pix-webhook] Error fetching payout', { error: fetchError, txid });
        continue;
      }

      if (!payout) {
        console.warn('[pix-webhook] Payout not found for txid', { txid });
        continue;
      }

      // Verificar se já está em estado final
      if (payout.status === 'paid' || payout.status === 'failed') {
        console.log('[pix-webhook] Payout already in final state', {
          payoutId: payout.id,
          status: payout.status,
        });
        continue;
      }

      const walletType = payout.source_type === 'creator' ? 'creator' : 'affiliate';
      const normalizedStatus = status?.toUpperCase();

      // Status de sucesso
      if (normalizedStatus === 'CONCLUIDA' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'SUCCESS') {
        console.log('[pix-webhook] Processing SUCCESS', { payoutId: payout.id, txid });

        // Atualizar payout para paid
        await supabaseAdmin
          .from('payout_requests')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            psp_response: pixData,
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
          balance_after_cents: 0, // Já foi debitado
          reference_type: 'payout_request',
          reference_id: payout.id,
          description: `Saque PIX confirmado - R$ ${(payout.amount / 100).toFixed(2)}`,
          metadata: { action: 'withdrawal.release', e2eId, txid },
        });

        // Atualizar transação
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'completed' })
          .eq('external_id', txid);

        // Notificar usuário
        await supabaseAdmin.from('notifications').insert({
          user_id: payout.creator_id,
          type: 'withdrawal',
          title: 'Saque concluído!',
          message: `Seu saque de R$ ${(payout.amount / 100).toFixed(2)} foi depositado via PIX.`,
        });

        console.log('[pix-webhook] Payout marked as PAID', { payoutId: payout.id });
      }
      // Status de falha
      else if (normalizedStatus === 'REJEITADA' || normalizedStatus === 'ERRO' || normalizedStatus === 'FAILED' || normalizedStatus === 'REJECTED') {
        console.log('[pix-webhook] Processing FAILURE', { payoutId: payout.id, txid, reason: failureReason });

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
            psp_response: pixData,
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
          metadata: { action: 'withdrawal.refund', reason: failureReason, txid },
        });

        // Atualizar transação
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'failed' })
          .eq('external_id', txid);

        // Notificar usuário
        await supabaseAdmin.from('notifications').insert({
          user_id: payout.creator_id,
          type: 'withdrawal',
          title: 'Saque falhou',
          message: `Seu saque de R$ ${(payout.amount / 100).toFixed(2)} não pôde ser processado. O valor foi devolvido ao seu saldo. Motivo: ${failureReason || 'Rejeitado pelo banco'}`,
        });

        console.log('[pix-webhook] Payout marked as FAILED, balance refunded', { payoutId: payout.id });
      }
      // Status desconhecido
      else {
        console.warn('[pix-webhook] Unknown status received', { status, txid });
      }
    }

    // Registrar log do webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'efi_pix',
      event_type: 'pix_disbursement',
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
    console.error('[pix-webhook] Unexpected error:', error);
    
    // Retornar 200 mesmo com erro para evitar loop de retentativas
    return new Response(
      JSON.stringify({ received: true, error: 'Internal processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
