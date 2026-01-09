// supabase/functions/velana-webhook/index.ts
// Processa webhooks da Velana.io - Cash-In (pagamentos) e Cash-Out (saques)

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VELANA_WEBHOOK_SECRET = Deno.env.get('VELANA_WEBHOOK_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-velana-signature',
};

// Commission distribution for registration (in BRL)
const DIRECT_COMMISSION = 1.00;  // Parent gets R$1.00
const ROOT_COMMISSION = 0.50;    // Grandparent gets R$0.50
const MAX_RETRIES = 3;
const WEBHOOK_VERSION = '2.0.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let webhookLogId: string | null = null;
  let payload: any = null;

  try {
    // Valida assinatura do webhook (se configurada)
    const signature = req.headers.get('X-Velana-Signature');
    if (VELANA_WEBHOOK_SECRET && signature) {
      console.log(`[velana-webhook v${WEBHOOK_VERSION}] Signature present`);
    }

    payload = await req.json();
    console.log(`[velana-webhook v${WEBHOOK_VERSION}] Received:`, JSON.stringify(payload));

    // Log the incoming webhook immediately
    const { data: logData } = await supabase
      .from('webhook_logs')
      .insert({
        source: 'velana',
        event_type: payload.event || payload.status || 'unknown',
        payload: payload,
        status: 'received',
      })
      .select('id')
      .single();

    webhookLogId = logData?.id || null;

    // Detect webhook type: event-based (cash-out) or transaction update (cash-in)
    const event = payload.event;
    
    if (event) {
      // Event-based webhook (Cash-Out / Payouts)
      const result = await processCashOutEvent(supabase, payload, webhookLogId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Transaction update webhook (Cash-In / Payments)
      const result = await processCashInTransaction(supabase, payload, webhookLogId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[velana-webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ status: 'error', error_message: errorMessage, processed_at: new Date().toISOString() })
        .eq('id', webhookLogId);
    } else if (payload) {
      await supabase
        .from('webhook_logs')
        .insert({
          source: 'velana',
          event_type: 'error',
          payload: payload,
          status: 'error',
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ========== CASH-OUT (Payouts / Withdrawals) ==========
// Velana Transfer Status: pending | bank_processing | success | failed

async function processCashOutEvent(supabase: any, payload: any, webhookLogId: string | null): Promise<any> {
  // Velana pode enviar diretamente o objeto da transferência OU um evento com data
  let event = payload.event;
  let data = payload.data || payload;
  const transferStatus = payload.status || data?.status;
  
  // Se não tiver event, inferir pelo status
  if (!event && transferStatus) {
    if (transferStatus === 'success') {
      event = 'transfer.success';
    } else if (transferStatus === 'failed') {
      event = 'transfer.failed';
    } else if (transferStatus === 'bank_processing') {
      event = 'transfer.bank_processing';
    } else if (transferStatus === 'pending') {
      event = 'transfer.pending';
    }
  }

  console.log('[velana-webhook] Processing cash-out:', { event, status: transferStatus, id: payload.id || data?.id });

  // Busca payout por externalId OU por psp_transaction_id (transferId da Velana)
  const externalId = data.externalId || data.correlationId || payload.externalId;
  const transferId = payload.id || data.id;
  
  let payout = null;
  
  // Primeiro tenta por externalId (correlationId/idempotency_key)
  if (externalId) {
    const { data: foundPayout } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('idempotency_key', externalId)
      .maybeSingle();
    payout = foundPayout;
  }
  
  // Se não encontrou, tenta por psp_transaction_id
  if (!payout && transferId) {
    const { data: foundPayout } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('psp_transaction_id', transferId)
      .maybeSingle();
    payout = foundPayout;
  }

  if (!payout) {
    console.error('[velana-webhook] Payout not found:', { externalId, transferId });
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ 
          status: 'error', 
          error_message: `Payout not found: externalId=${externalId}, transferId=${transferId}`, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', webhookLogId);
    }
    return { error: 'Payout not found' };
  }

  // Processa baseado no status da Velana
  const velanaStatus = transferStatus || event?.replace('transfer.', '');
  
  switch (velanaStatus) {
    case 'success':
    case 'completed':
    case 'succeeded': {
      await supabase
        .from('payout_requests')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          psp_response: payload,
        })
        .eq('id', payout.id);

      // Limpa pending_cents
      const { data: wallet } = await supabase
        .from('creator_wallet')
        .select('pending_cents')
        .eq('creator_id', payout.creator_id)
        .maybeSingle();

      if (wallet) {
        const amountCents = Math.round(payout.amount * 100);
        await supabase
          .from('creator_wallet')
          .update({
            pending_cents: Math.max(0, (wallet.pending_cents || 0) - amountCents),
          })
          .eq('creator_id', payout.creator_id);
      }

      // Registra no ledger
      await supabase.from('wallet_transactions').insert({
        wallet_type: payout.source_type || 'creator',
        wallet_id: payout.creator_id,
        type: 'payout_completed',
        amount_cents: -Math.round(payout.amount * 100),
        balance_after_cents: 0, // Já foi debitado no hold
        reference_type: 'payout_request',
        reference_id: payout.id,
        description: `Saque PIX concluído - R$ ${payout.amount.toFixed(2)}`,
        metadata: { action: 'withdrawal.completed', velana_status: velanaStatus },
      });

      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '💰 Saque concluído!',
        message: `Seu saque de R$ ${payout.amount.toFixed(2)} foi depositado via PIX.`,
        type: 'withdrawal_completed',
      });

      console.log('[velana-webhook] Payout marked as paid:', payout.id);
      break;
    }

    case 'failed': {
      await supabase
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: data.error || data.failureReason || payload.failureReason || 'Falha no processamento PIX',
          psp_response: payload,
        })
        .eq('id', payout.id);

      // Estorna saldo
      const amountCents = Math.round(payout.amount * 100);
      const { data: wallet } = await supabase
        .from('creator_wallet')
        .select('balance_cents, pending_cents')
        .eq('creator_id', payout.creator_id)
        .maybeSingle();

      if (wallet) {
        await supabase
          .from('creator_wallet')
          .update({
            balance_cents: (wallet.balance_cents || 0) + amountCents,
            pending_cents: Math.max(0, (wallet.pending_cents || 0) - amountCents),
          })
          .eq('creator_id', payout.creator_id);
      }

      // Também estorna affiliate_earnings se aplicável
      if (payout.source_type === 'affiliate') {
        await supabase.rpc('increment_affiliate_earnings', {
          p_profile_id: payout.creator_id,
          p_amount_cents: amountCents,
        });
      }

      // Registra estorno no ledger
      await supabase.from('wallet_transactions').insert({
        wallet_type: payout.source_type || 'creator',
        wallet_id: payout.creator_id,
        type: 'refund',
        amount_cents: amountCents,
        balance_after_cents: (wallet?.balance_cents || 0) + amountCents,
        reference_type: 'payout_request',
        reference_id: payout.id,
        description: `Estorno saque PIX - R$ ${payout.amount.toFixed(2)}`,
        metadata: { action: 'withdrawal.refund', velana_status: velanaStatus, reason: data.error || data.failureReason },
      });

      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '❌ Saque falhou',
        message: `Seu saque de R$ ${payout.amount.toFixed(2)} não pôde ser processado. O valor foi devolvido à sua carteira.`,
        type: 'withdrawal_failed',
      });

      console.log('[velana-webhook] Payout marked as failed:', payout.id);
      break;
    }

    case 'bank_processing': {
      await supabase
        .from('payout_requests')
        .update({
          status: 'processing',
          psp_response: payload,
          admin_notes: 'Transferência em processamento no banco',
        })
        .eq('id', payout.id);

      console.log('[velana-webhook] Payout in bank processing:', payout.id);
      break;
    }

    case 'pending': {
      await supabase
        .from('payout_requests')
        .update({
          status: 'processing',
          psp_response: payload,
        })
        .eq('id', payout.id);

      console.log('[velana-webhook] Payout pending:', payout.id);
      break;
    }

    default:
      console.log('[velana-webhook] Unhandled status:', velanaStatus);
  }

  if (webhookLogId) {
    await supabase
      .from('webhook_logs')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', webhookLogId);
  }

  return { received: true, status: velanaStatus, payoutId: payout.id };
}

// ========== CASH-IN (Payments / Transactions) ==========

async function processCashInTransaction(supabase: any, payload: any, webhookLogId: string | null): Promise<any> {
  const transactionId = payload.id || payload.transactionId;
  const status = payload.status;

  if (!transactionId) {
    console.log('[velana-webhook] No transaction ID');
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ status: 'error', error_message: 'No transaction ID', processed_at: new Date().toISOString() })
        .eq('id', webhookLogId);
    }
    return { error: 'No transaction ID' };
  }

  // Only process paid/approved transactions
  const paidStatuses = ['paid', 'approved', 'captured', 'authorized'];
  if (!paidStatuses.includes(status?.toLowerCase())) {
    console.log('[velana-webhook] Transaction not paid:', status);
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ status: 'ignored', processed_at: new Date().toISOString() })
        .eq('id', webhookLogId);
    }
    return { success: true, ignored: true, status };
  }

  // Process with retry logic
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[velana-webhook] Processing attempt ${attempt}/${MAX_RETRIES}`);

      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({ retry_count: attempt - 1 })
          .eq('id', webhookLogId);
      }

      const result = await processPaymentTransaction(supabase, payload);

      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            retry_count: attempt - 1,
          })
          .eq('id', webhookLogId);
      }

      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[velana-webhook] Attempt ${attempt} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (webhookLogId) {
    await supabase
      .from('webhook_logs')
      .update({
        status: 'failed',
        error_message: lastError?.message || 'Max retries exceeded',
        processed_at: new Date().toISOString(),
        retry_count: MAX_RETRIES,
      })
      .eq('id', webhookLogId);
  }

  throw lastError || new Error('Processing failed after max retries');
}

async function processPaymentTransaction(supabase: any, payload: any): Promise<any> {
  const transactionId = String(payload.id || payload.transactionId);
  const amount = payload.amount; // Amount in cents
  const amountBRL = amount / 100;

  // Parse metadata (Velana stores as string)
  let metadata: Record<string, any> = {};
  if (typeof payload.metadata === 'string') {
    try {
      metadata = JSON.parse(payload.metadata);
    } catch {
      metadata = {};
    }
  } else if (payload.metadata) {
    metadata = payload.metadata;
  }

  const eventType = (metadata.event_type || metadata.eventType || 'LIVE_ACCESS').toUpperCase();
  const userId = metadata.user_id || metadata.userId;
  const externalRef = metadata.payment_id || payload.externalRef || transactionId;

  console.log('[velana-webhook] Processing payment:', { eventType, userId, amount, externalRef });

  // Idempotency check
  const { data: existingPayment } = await supabase
    .from('transactions')
    .select('id')
    .eq('external_id', externalRef)
    .maybeSingle();

  if (existingPayment) {
    console.log('[velana-webhook] Duplicate, skipping:', externalRef);
    return { success: true, duplicate: true };
  }

  // Helper function to notify admins
  const notifyAdmins = async (title: string, message: string, type: string) => {
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin: any) => ({
        user_id: admin.user_id,
        title,
        message,
        type,
      }));
      await supabase.from('notifications').insert(notifications);
    }
  };

  // Process based on event type
  if (eventType === 'CREDITS_PURCHASE' || eventType === 'CREDITS') {
    const credits = metadata.credits || Math.round((amount / 500) * 180);
    console.log('[velana-webhook] Processing credits:', { userId, credits, amount });

    const { data: wallet } = await supabase
      .from('credits_wallet')
      .select('balance_credits')
      .eq('user_id', userId)
      .maybeSingle();

    if (wallet) {
      await supabase
        .from('credits_wallet')
        .update({ balance_credits: (wallet.balance_credits || 0) + credits })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('credits_wallet')
        .insert({ user_id: userId, balance_credits: credits });
    }

    await supabase.from('platform_revenue').insert({
      source_type: 'credits_purchase',
      source_id: externalRef,
      amount: amount,
      user_id: userId,
      metadata: { credits, gross_amount: amount },
    });

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'credits_purchase',
      amount: amountBRL,
      platform_amount: amountBRL,
      status: 'completed',
      payment_method: 'pix_velana',
      external_id: externalRef,
      metadata: { credits, event_type: eventType, velana_id: transactionId },
    });

    await notifyAdmins(
      'Nova compra de créditos (PIX)',
      `Compra de ${credits} créditos por R$ ${amountBRL.toFixed(2)}`,
      'payment'
    );

    console.log('[velana-webhook] Credits added:', { userId, credits });

  } else if (eventType === 'REGISTRATION') {
    let directId = metadata.direct_id || metadata.directId;
    let rootId = metadata.root_id || metadata.rootId;

    console.log('[velana-webhook] Processing registration:', { userId, directId, rootId });

    if (!directId && externalRef) {
      const { data: pendingRef } = await supabase
        .from('registration_referrals')
        .select('referrer_id, referrer_parent_id')
        .eq('payment_id', externalRef)
        .maybeSingle();

      if (pendingRef) {
        directId = pendingRef.referrer_id;
        rootId = pendingRef.referrer_parent_id;
      }
    }

    await supabase
      .from('profiles')
      .update({
        status: 'active',
        is_subscribed: true,
        referred_by: directId,
        referrer_direct: directId,
        referrer_root: rootId,
      })
      .eq('id', userId);

    let platformAmountCents = amount;

    if (directId) {
      const directAmountCents = Math.round(DIRECT_COMMISSION * 100);
      platformAmountCents -= directAmountCents;

      await supabase.rpc('increment_affiliate_earnings', {
        p_profile_id: directId,
        p_amount_cents: directAmountCents,
      });

      if (rootId && rootId !== directId) {
        const rootAmountCents = Math.round(ROOT_COMMISSION * 100);
        platformAmountCents -= rootAmountCents;

        await supabase.rpc('increment_affiliate_earnings', {
          p_profile_id: rootId,
          p_amount_cents: rootAmountCents,
        });
      }

      await supabase.from('referrals').insert({
        referrer_id: directId,
        referred_id: userId,
        referral_code: metadata.referral_code || 'DIRECT',
        commission_earned: DIRECT_COMMISSION,
        status: 'completed',
      });

      await supabase.from('affiliate_logs').insert({
        new_user: userId,
        direct_referrer: directId,
        root_creator: (rootId && rootId !== directId) ? rootId : null,
        amount_direct: Math.round(DIRECT_COMMISSION * 100),
        amount_root: (rootId && rootId !== directId) ? Math.round(ROOT_COMMISSION * 100) : 0,
        amount_platform: platformAmountCents,
        event_type: 'REGISTRATION',
        payment_id: externalRef,
      });
    }

    await supabase.from('platform_revenue').insert({
      source_type: 'registration',
      source_id: externalRef,
      amount: platformAmountCents,
      user_id: userId,
      metadata: { direct_id: directId, root_id: rootId, gross_amount: amount },
    });

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'registration',
      amount: amountBRL,
      platform_amount: platformAmountCents / 100,
      status: 'completed',
      payment_method: 'pix_velana',
      external_id: externalRef,
      metadata: { event_type: eventType, direct_id: directId, root_id: rootId, velana_id: transactionId },
    });

    await supabase
      .from('registration_referrals')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'pending');

    await notifyAdmins(
      'Novo cadastro pago (PIX)',
      `Novo usuário registrado por R$ ${amountBRL.toFixed(2)}`,
      'registration'
    );

    console.log('[velana-webhook] Registration completed:', userId);

  } else if (eventType === 'LIVE_ACCESS') {
    const liveId = metadata.live_id || metadata.liveId;
    console.log('[velana-webhook] Processing live access:', { userId, liveId });

    if (liveId) {
      await supabase.from('live_access').upsert({
        live_id: liveId,
        user_id: userId,
        granted_at: new Date().toISOString(),
      }, { onConflict: 'live_id,user_id' });
    }

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'live_access',
      amount: amountBRL,
      status: 'completed',
      payment_method: 'pix_velana',
      external_id: externalRef,
      metadata: { event_type: eventType, live_id: liveId, velana_id: transactionId },
    });

    console.log('[velana-webhook] Live access granted:', { userId, liveId });

  } else if (eventType === 'SUPERCHAT') {
    const roomId = metadata.room_id || metadata.roomId;
    const creatorId = metadata.creator_id || metadata.creatorId;
    const tier = metadata.tier;
    const duration = metadata.duration;
    const message = metadata.message;

    console.log('[velana-webhook] Processing superchat:', { userId, roomId, tier, amount });

    const creatorAmountCents = Math.round(amount * 0.8);
    const platformAmountCents = amount - creatorAmountCents;

    await supabase.from('superchats').insert({
      room_id: roomId,
      user_id: userId,
      creator_id: creatorId,
      message: message,
      amount: amount,
      tier: tier,
      duration_seconds: duration,
      status: 'pending',
      payment_id: externalRef,
    });

    await supabase.from('transactions').insert({
      user_id: userId,
      creator_id: creatorId,
      type: 'superchat',
      amount: amountBRL,
      creator_amount: creatorAmountCents / 100,
      platform_amount: platformAmountCents / 100,
      status: 'completed',
      payment_method: 'pix_velana',
      external_id: externalRef,
      metadata: { event_type: eventType, room_id: roomId, tier, duration, velana_id: transactionId },
    });

    const { data: creatorWallet } = await supabase
      .from('creator_wallet')
      .select('balance_cents, total_earned_cents')
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (creatorWallet) {
      await supabase
        .from('creator_wallet')
        .update({ 
          balance_cents: (creatorWallet.balance_cents || 0) + creatorAmountCents,
          total_earned_cents: (creatorWallet.total_earned_cents || 0) + creatorAmountCents,
          updated_at: new Date().toISOString(),
        })
        .eq('creator_id', creatorId);
    } else {
      await supabase
        .from('creator_wallet')
        .insert({ 
          creator_id: creatorId, 
          balance_cents: creatorAmountCents,
          total_earned_cents: creatorAmountCents,
        });
    }

    await supabase.from('platform_revenue').insert({
      source_type: 'superchat',
      source_id: externalRef,
      amount: platformAmountCents,
      user_id: userId,
      metadata: {
        creator_id: creatorId,
        tier,
        gross_amount: amount,
        creator_amount: creatorAmountCents,
      },
    });

    await notifyAdmins(
      'Novo SuperChat (PIX)',
      `SuperChat ${tier} de R$ ${amountBRL.toFixed(2)}`,
      'superchat'
    );

    console.log('[velana-webhook] SuperChat processed:', { userId, roomId, tier });
  }

  return { success: true, processed: eventType };
}
