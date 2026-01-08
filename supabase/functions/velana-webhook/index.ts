// supabase/functions/velana-webhook/index.ts
// Processa webhooks da Velana.io

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VELANA_WEBHOOK_SECRET = Deno.env.get('VELANA_WEBHOOK_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-velana-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Valida assinatura do webhook (se Velana usar)
    const signature = req.headers.get('X-Velana-Signature');
    
    if (VELANA_WEBHOOK_SECRET && signature) {
      // TODO: Implementar validação de assinatura quando documentação especificar
      console.log('Webhook signature:', signature);
    }

    // 2. Parse do payload
    const payload = await req.json();
    console.log('Velana webhook received:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;

    if (!event || !data) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Processa evento baseado no tipo
    switch (event) {
      case 'transfer.completed':
      case 'transfer.succeeded':
      case 'pix.completed': {
        // Transferência PIX concluída com sucesso
        const externalId = data.externalId || data.correlationId;

        if (!externalId) {
          console.error('Missing externalId in webhook');
          break;
        }

        // Busca payout_request pelo idempotency_key
        const { data: payout, error: fetchError } = await supabase
          .from('payout_requests')
          .select('*')
          .eq('idempotency_key', externalId)
          .maybeSingle();

        if (fetchError || !payout) {
          console.error('Payout not found:', externalId);
          break;
        }

        // Atualiza status para 'paid'
        await supabase
          .from('payout_requests')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            psp_response: data,
          })
          .eq('id', payout.id);

        // Zera pending_cents na carteira
        const { data: wallet } = await supabase
          .from('creator_wallet')
          .select('pending_cents')
          .eq('creator_id', payout.creator_id)
          .maybeSingle();

        if (wallet) {
          await supabase
            .from('creator_wallet')
            .update({
              pending_cents: Math.max(0, wallet.pending_cents - payout.amount * 100),
            })
            .eq('creator_id', payout.creator_id);
        }

        // Cria notificação para o usuário
        await supabase.from('notifications').insert({
          user_id: payout.creator_id,
          title: '💰 Saque concluído!',
          message: `Seu saque de R$ ${payout.amount.toFixed(2)} foi depositado via PIX.`,
          type: 'withdrawal_completed',
        });

        console.log('Payout marked as paid:', payout.id);
        break;
      }

      case 'transfer.failed':
      case 'pix.failed': {
        // Transferência PIX falhou
        const externalId = data.externalId || data.correlationId;

        if (!externalId) {
          console.error('Missing externalId in webhook');
          break;
        }

        const { data: payout, error: fetchError } = await supabase
          .from('payout_requests')
          .select('*')
          .eq('idempotency_key', externalId)
          .maybeSingle();

        if (fetchError || !payout) {
          console.error('Payout not found:', externalId);
          break;
        }

        // Atualiza status para 'failed'
        await supabase
          .from('payout_requests')
          .update({
            status: 'failed',
            failure_reason: data.error || 'Falha no processamento PIX',
            psp_response: data,
          })
          .eq('id', payout.id);

        // Devolve saldo para o criador
        const { data: wallet } = await supabase
          .from('creator_wallet')
          .select('balance_cents, pending_cents')
          .eq('creator_id', payout.creator_id)
          .maybeSingle();

        const amountCents = Math.round(payout.amount * 100);

        // Devolve para carteira de criador
        if (wallet) {
          await supabase
            .from('creator_wallet')
            .update({
              balance_cents: wallet.balance_cents + amountCents,
              pending_cents: Math.max(0, wallet.pending_cents - amountCents),
            })
            .eq('creator_id', payout.creator_id);
        }

        // Notifica usuário da falha
        await supabase.from('notifications').insert({
          user_id: payout.creator_id,
          title: '❌ Saque falhou',
          message: `Seu saque de R$ ${payout.amount.toFixed(2)} não pôde ser processado. O valor foi devolvido à sua carteira.`,
          type: 'withdrawal_failed',
        });

        console.log('Payout marked as failed:', payout.id);
        break;
      }

      default:
        console.log('Unhandled event:', event);
    }

    // 4. Responde sucesso
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error in velana-webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
