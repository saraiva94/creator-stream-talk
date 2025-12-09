import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commission distribution for registration
const DIRECT_COMMISSION = 1.00;  // Parent gets R$1.00
const ROOT_COMMISSION = 0.50;   // Grandparent gets R$0.50
const MAX_RETRIES = 3;

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
    payload = await req.json();
    console.log('[webhook] Mercado Pago webhook received:', JSON.stringify(payload));

    // Log the incoming webhook immediately
    const { data: logData } = await supabase
      .from('webhook_logs')
      .insert({
        source: 'mercadopago',
        event_type: payload.type || payload.action || 'unknown',
        payload: payload,
        status: 'received',
      })
      .select('id')
      .single();

    webhookLogId = logData?.id || null;
    console.log('[webhook] Logged webhook:', webhookLogId);

    // Handle different webhook formats
    if (payload.type !== 'payment' && payload.action !== 'payment.created' && payload.action !== 'payment.updated') {
      console.log('[webhook] Ignoring non-payment event:', payload.type || payload.action);
      
      // Update log status
      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({ status: 'ignored', processed_at: new Date().toISOString() })
          .eq('id', webhookLogId);
      }
      
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentId = payload.data?.id || payload.id;
    if (!paymentId) {
      console.error('[webhook] No payment ID in payload');
      
      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({ 
            status: 'error', 
            error_message: 'No payment ID in payload',
            processed_at: new Date().toISOString() 
          })
          .eq('id', webhookLogId);
      }
      
      return new Response(JSON.stringify({ error: 'No payment ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process with retry logic
    const result = await processPaymentWithRetry(supabase, paymentId, webhookLogId);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the error
    if (webhookLogId) {
      await supabase
        .from('webhook_logs')
        .update({ 
          status: 'error', 
          error_message: errorMessage,
          processed_at: new Date().toISOString() 
        })
        .eq('id', webhookLogId);
    } else if (payload) {
      // If we couldn't log initially, try now
      await supabase
        .from('webhook_logs')
        .insert({
          source: 'mercadopago',
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

async function processPaymentWithRetry(
  supabase: any, 
  paymentId: string, 
  webhookLogId: string | null
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[webhook] Processing attempt ${attempt}/${MAX_RETRIES} for payment:`, paymentId);
      
      // Update retry count in log
      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({ retry_count: attempt - 1 })
          .eq('id', webhookLogId);
      }
      
      const result = await processPayment(supabase, paymentId);
      
      // Success - update log
      if (webhookLogId) {
        await supabase
          .from('webhook_logs')
          .update({ 
            status: 'processed', 
            processed_at: new Date().toISOString(),
            retry_count: attempt - 1
          })
          .eq('id', webhookLogId);
      }
      
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[webhook] Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[webhook] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  if (webhookLogId) {
    await supabase
      .from('webhook_logs')
      .update({ 
        status: 'failed', 
        error_message: lastError?.message || 'Max retries exceeded',
        processed_at: new Date().toISOString(),
        retry_count: MAX_RETRIES
      })
      .eq('id', webhookLogId);
  }
  
  throw lastError || new Error('Processing failed after max retries');
}

async function processPayment(supabase: any, paymentId: string): Promise<any> {
  // Fetch payment details from Mercado Pago
  const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!mpToken) {
    throw new Error('Missing Mercado Pago access token');
  }

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${mpToken}` },
  });

  if (!paymentResponse.ok) {
    const errorText = await paymentResponse.text();
    console.error('[webhook] Failed to fetch payment:', errorText);
    throw new Error(`Failed to fetch payment: ${errorText}`);
  }

  const payment = await paymentResponse.json();
  console.log('[webhook] Payment details:', { 
    id: payment.id, 
    status: payment.status, 
    metadata: payment.metadata 
  });

  if (payment.status !== 'approved') {
    console.log('[webhook] Payment not approved:', payment.status);
    return { success: true, status: payment.status };
  }

  const metadata = payment.metadata || {};
  const eventType = (metadata.event_type || 'LIVE_ACCESS').toUpperCase();
  const userId = metadata.user_id;
  const externalRef = payment.external_reference || paymentId.toString();
  const amount = payment.transaction_amount;

  console.log('[webhook] Processing:', { eventType, userId, amount, externalRef });

  // Idempotency check
  const { data: existingPayment } = await supabase
    .from('transactions')
    .select('id')
    .eq('external_id', externalRef)
    .maybeSingle();

  if (existingPayment) {
    console.log('[webhook] Duplicate payment, skipping:', externalRef);
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
      console.log('[webhook] Admin notifications sent:', notifications.length);
    }
  };

  // Process based on event type
  if (eventType === 'CREDITS_PURCHASE' || eventType === 'CREDITS') {
    const credits = metadata.credits || Math.round((amount / 5) * 180);
    console.log('[webhook] Processing credits purchase:', { userId, credits, amount });

    // Update or create credits wallet
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

    // Record platform revenue (100% for credits since no affiliate split)
    const platformAmountCents = Math.round(amount * 100);
    await supabase.from('platform_revenue').insert({
      source_type: 'credits_purchase',
      source_id: externalRef,
      amount: platformAmountCents,
      user_id: userId,
      metadata: { credits, gross_amount: platformAmountCents },
    });

    console.log('[webhook] Platform revenue recorded for credits:', { amountCents: platformAmountCents });

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'credits_purchase',
      amount,
      platform_amount: amount,
      status: 'completed',
      payment_method: payment.payment_method_id,
      external_id: externalRef,
      metadata: { credits, event_type: eventType },
    });

    await notifyAdmins(
      'Nova compra de créditos',
      `Compra de ${credits} créditos por R$ ${amount.toFixed(2)}`,
      'payment'
    );

    console.log('[webhook] Credits added:', { userId, credits });

  } else if (eventType === 'REGISTRATION') {
    let directId = metadata.direct_id;
    let rootId = metadata.root_id;

    console.log('[webhook] Processing registration:', { userId, directId, rootId, externalRef });

    // If directId/rootId not in metadata, try to fetch from registration_referrals
    if (!directId && externalRef) {
      const { data: pendingRef } = await supabase
        .from('registration_referrals')
        .select('referrer_id, referrer_parent_id, is_root_creator')
        .eq('payment_id', externalRef)
        .maybeSingle();

      if (pendingRef) {
        directId = pendingRef.referrer_id;
        rootId = pendingRef.referrer_parent_id;
        console.log('[webhook] Found pending registration referral:', { directId, rootId });
      }
    }

    // Also try to fetch by user_id if still no directId
    if (!directId && userId) {
      const { data: pendingByUser } = await supabase
        .from('registration_referrals')
        .select('referrer_id, referrer_parent_id, payment_id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingByUser) {
        directId = pendingByUser.referrer_id;
        rootId = pendingByUser.referrer_parent_id;
        console.log('[webhook] Found pending registration by user_id:', { directId, rootId });
      }
    }


    // Activate user profile
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

    console.log('[webhook] Profile activated:', { userId, status: 'active' });

    // Calculate platform revenue (after affiliate commissions)
    let platformAmountCents = Math.round(amount * 100);
    
    // Process affiliate commissions
    if (directId) {
      const directAmountCents = Math.round(DIRECT_COMMISSION * 100);
      platformAmountCents -= directAmountCents;
      
      const { error: directError } = await supabase.rpc('increment_affiliate_earnings', {
        p_profile_id: directId,
        p_amount_cents: directAmountCents,
      });

      if (directError) {
        console.error('[webhook] Failed to increment direct affiliate earnings:', directError);
      } else {
        console.log('[webhook] Direct commission paid:', { directId, amountCents: directAmountCents });
      }

      if (rootId && rootId !== directId) {
        const rootAmountCents = Math.round(ROOT_COMMISSION * 100);
        platformAmountCents -= rootAmountCents;
        
        const { error: rootError } = await supabase.rpc('increment_affiliate_earnings', {
          p_profile_id: rootId,
          p_amount_cents: rootAmountCents,
        });

        if (rootError) {
          console.error('[webhook] Failed to increment root affiliate earnings:', rootError);
        } else {
          console.log('[webhook] Root commission paid:', { rootId, amountCents: rootAmountCents });
        }
      }

      // Record referral
      await supabase.from('referrals').insert({
        referrer_id: directId,
        referred_id: userId,
        referral_code: metadata.referral_code || 'DIRECT',
        commission_earned: DIRECT_COMMISSION,
        status: 'completed',
      });

      // Record affiliate log
      const logDirectAmountCents = Math.round(DIRECT_COMMISSION * 100);
      const logRootAmountCents = (rootId && rootId !== directId) ? Math.round(ROOT_COMMISSION * 100) : 0;
      
      await supabase.from('affiliate_logs').insert({
        new_user: userId,
        direct_referrer: directId,
        root_creator: (rootId && rootId !== directId) ? rootId : null,
        amount_direct: logDirectAmountCents,
        amount_root: logRootAmountCents,
        amount_platform: platformAmountCents,
        event_type: 'REGISTRATION',
        payment_id: externalRef,
      });

      console.log('[webhook] Affiliate log recorded');
    }

    // Record platform revenue
    await supabase.from('platform_revenue').insert({
      source_type: 'registration',
      source_id: externalRef,
      amount: platformAmountCents,
      user_id: userId,
      metadata: { direct_id: directId, root_id: rootId, gross_amount: Math.round(amount * 100) },
    });

    console.log('[webhook] Platform revenue recorded:', { amountCents: platformAmountCents });

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'registration',
      amount,
      platform_amount: platformAmountCents / 100,
      status: 'completed',
      payment_method: payment.payment_method_id,
      external_id: externalRef,
      metadata: { event_type: eventType, direct_id: directId, root_id: rootId },
    });

    // Mark registration_referrals as completed
    await supabase
      .from('registration_referrals')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'pending');

    console.log('[webhook] Registration referral marked as completed');

    await notifyAdmins(
      'Novo cadastro pago',
      `Novo usuário registrado por R$ ${amount.toFixed(2)}`,
      'registration'
    );

    console.log('[webhook] Registration completed:', userId);

  } else if (eventType === 'LIVE_ACCESS') {
    const liveId = metadata.live_id;
    console.log('[webhook] Processing live access:', { userId, liveId });

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
      amount,
      status: 'completed',
      payment_method: payment.payment_method_id,
      external_id: externalRef,
      metadata: { event_type: eventType, live_id: liveId },
    });

    console.log('[webhook] Live access granted:', { userId, liveId });

  } else if (eventType === 'SUPERCHAT') {
    const roomId = metadata.room_id;
    const creatorId = metadata.creator_id;
    const tier = metadata.tier;
    const duration = metadata.duration;
    const message = metadata.message;

    console.log('[webhook] Processing superchat:', { userId, roomId, tier, amount });

    await supabase.from('superchats').insert({
      room_id: roomId,
      user_id: userId,
      creator_id: creatorId,
      message: message,
      amount: Math.round(amount * 100),
      tier: tier,
      duration_seconds: duration,
      status: 'pending',
      payment_id: externalRef,
    });

    await supabase.from('transactions').insert({
      user_id: userId,
      creator_id: creatorId,
      type: 'superchat',
      amount,
      status: 'completed',
      payment_method: payment.payment_method_id,
      external_id: externalRef,
      metadata: { event_type: eventType, room_id: roomId, tier, duration },
    });

    // Credit creator (80%)
    const creatorAmount = amount * 0.8;
    const { data: creatorWallet } = await supabase
      .from('creator_wallet')
      .select('balance_cents')
      .eq('creator_id', creatorId)
      .maybeSingle();

    if (creatorWallet) {
      await supabase
        .from('creator_wallet')
        .update({ balance_cents: (creatorWallet.balance_cents || 0) + Math.round(creatorAmount * 100) })
        .eq('creator_id', creatorId);
    } else {
      await supabase
        .from('creator_wallet')
        .insert({ creator_id: creatorId, balance_cents: Math.round(creatorAmount * 100) });
    }

    await notifyAdmins(
      'Novo SuperChat',
      `SuperChat ${tier} de R$ ${amount.toFixed(2)}`,
      'superchat'
    );

    console.log('[webhook] SuperChat processed:', { userId, roomId, tier, creatorAmount });
  }

  return { success: true, processed: eventType };
}
