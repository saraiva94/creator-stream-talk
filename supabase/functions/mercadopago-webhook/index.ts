import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Commission distribution for registration
const DIRECT_COMMISSION = 1.00;  // Parent gets R$1.00
const ROOT_COMMISSION = 0.50;   // Grandparent gets R$0.50

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('[webhook] Mercado Pago webhook received:', JSON.stringify(payload));

    // Handle different webhook formats
    if (payload.type !== 'payment' && payload.action !== 'payment.created' && payload.action !== 'payment.updated') {
      console.log('[webhook] Ignoring non-payment event:', payload.type || payload.action);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentId = payload.data?.id || payload.id;
    if (!paymentId) {
      console.error('[webhook] No payment ID in payload');
      return new Response(JSON.stringify({ error: 'No payment ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(JSON.stringify({ success: true, status: payment.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process based on event type
    // Helper function to notify admins
    const notifyAdmins = async (title: string, message: string, type: string) => {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.user_id,
          title,
          message,
          type,
        }));
        await supabase.from('notifications').insert(notifications);
        console.log('[webhook] Admin notifications sent:', notifications.length);
      }
    };

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

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'credits_purchase',
        amount,
        status: 'completed',
        payment_method: payment.payment_method_id,
        external_id: externalRef,
        metadata: { credits, event_type: eventType },
      });

      // Notify admins about new payment
      await notifyAdmins(
        'Nova compra de créditos',
        `Compra de ${credits} créditos por R$ ${amount.toFixed(2)}`,
        'payment'
      );

      console.log('[webhook] Credits added:', { userId, credits });

    } else if (eventType === 'REGISTRATION') {
      const directId = metadata.direct_id;
      const rootId = metadata.root_id;
      const email = metadata.email;

      console.log('[webhook] Processing registration:', { userId, directId, rootId });

      // Activate user profile - set status to active
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

      // Process affiliate commissions
      if (directId) {
        // Direct (parent) commission - R$1.00 - use affiliate_earnings (in cents)
        const directAmountCents = Math.round(DIRECT_COMMISSION * 100);
        
        // Use RPC to safely increment affiliate earnings
        const { error: directError } = await supabase.rpc('increment_affiliate_earnings', {
          p_profile_id: directId,
          p_amount_cents: directAmountCents,
        });

        if (directError) {
          console.error('[webhook] Failed to increment direct affiliate earnings:', directError);
        } else {
          console.log('[webhook] Direct commission paid to affiliate_earnings:', { directId, amountCents: directAmountCents });
        }

        // Root (grandparent) commission - R$0.50 - use affiliate_earnings (in cents)
        if (rootId && rootId !== directId) {
          const rootAmountCents = Math.round(ROOT_COMMISSION * 100);
          
          const { error: rootError } = await supabase.rpc('increment_affiliate_earnings', {
            p_profile_id: rootId,
            p_amount_cents: rootAmountCents,
          });

          if (rootError) {
            console.error('[webhook] Failed to increment root affiliate earnings:', rootError);
          } else {
            console.log('[webhook] Root commission paid to affiliate_earnings:', { rootId, amountCents: rootAmountCents });
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

        // Record affiliate log for tracking
        const logDirectAmountCents = Math.round(DIRECT_COMMISSION * 100);
        const logRootAmountCents = (rootId && rootId !== directId) ? Math.round(ROOT_COMMISSION * 100) : 0;
        const logPlatformAmountCents = Math.round(amount * 100) - logDirectAmountCents - logRootAmountCents;
        
        await supabase.from('affiliate_logs').insert({
          new_user: userId,
          direct_referrer: directId,
          root_creator: (rootId && rootId !== directId) ? rootId : null,
          amount_direct: logDirectAmountCents,
          amount_root: logRootAmountCents,
          amount_platform: logPlatformAmountCents,
          event_type: 'REGISTRATION',
          payment_id: externalRef,
        });

        console.log('[webhook] Affiliate log recorded:', { logDirectAmountCents, logRootAmountCents, logPlatformAmountCents });
      }

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'registration',
        amount,
        status: 'completed',
        payment_method: payment.payment_method_id,
        external_id: externalRef,
        metadata: { event_type: eventType, direct_id: directId, root_id: rootId },
      });

      // Notify admins about new registration
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
        // Grant live access
        await supabase.from('live_access').upsert({
          live_id: liveId,
          user_id: userId,
          granted_at: new Date().toISOString(),
        }, { onConflict: 'live_id,user_id' });
      }

      // Record transaction
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

      // Create superchat record
      await supabase.from('superchats').insert({
        room_id: roomId,
        user_id: userId,
        creator_id: creatorId,
        message: message,
        amount: Math.round(amount * 100), // Convert to cents
        tier: tier,
        duration_seconds: duration,
        status: 'pending',
        payment_id: externalRef,
      });

      // Record transaction
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

      // Credit creator (80% of superchat)
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

      // Notify admins about superchat
      await notifyAdmins(
        'Novo SuperChat',
        `SuperChat ${tier} de R$ ${amount.toFixed(2)}`,
        'superchat'
      );

      console.log('[webhook] SuperChat processed:', { userId, roomId, tier, creatorAmount });
    }

    return new Response(JSON.stringify({ success: true, processed: eventType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
