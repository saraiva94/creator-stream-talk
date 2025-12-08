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

    const { paymentId } = await req.json();

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'Payment ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[process-pending] Processing payment:', paymentId);

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
      console.error('[process-pending] Failed to fetch payment:', errorText);
      return new Response(JSON.stringify({ error: 'Payment not found', details: errorText }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payment = await paymentResponse.json();
    console.log('[process-pending] Payment details:', { 
      id: payment.id, 
      status: payment.status, 
      metadata: payment.metadata,
      amount: payment.transaction_amount,
      payer: payment.payer,
      description: payment.description,
    });

    if (payment.status !== 'approved') {
      return new Response(JSON.stringify({ 
        error: 'Payment not approved', 
        status: payment.status 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metadata = payment.metadata || {};
    const externalRef = payment.external_reference || paymentId.toString();
    const amount = payment.transaction_amount;

    // Check if already processed
    const { data: existingPayment } = await supabase
      .from('transactions')
      .select('id')
      .eq('external_id', externalRef)
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment already processed', 
        duplicate: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine event type from metadata or payment description
    const eventType = (metadata.event_type || 'REGISTRATION').toUpperCase();
    const userId = metadata.user_id;
    const directId = metadata.direct_id;
    const rootId = metadata.root_id;

    console.log('[process-pending] Processing:', { eventType, userId, directId, rootId, amount });

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
        console.log('[process-pending] Admin notifications sent:', notifications.length);
      }
    };

    if (eventType === 'REGISTRATION' && userId) {
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

      console.log('[process-pending] Profile activated:', userId);

      // Process affiliate commissions
      if (directId) {
        // Direct commission
        const directAmountCents = Math.round(DIRECT_COMMISSION * 100);
        const { error: directError } = await supabase.rpc('increment_affiliate_earnings', {
          p_profile_id: directId,
          p_amount_cents: directAmountCents,
        });

        if (directError) {
          console.error('[process-pending] Direct commission error:', directError);
        } else {
          console.log('[process-pending] Direct commission paid:', { directId, amountCents: directAmountCents });
        }

        // Root commission
        if (rootId && rootId !== directId) {
          const rootAmountCents = Math.round(ROOT_COMMISSION * 100);
          const { error: rootError } = await supabase.rpc('increment_affiliate_earnings', {
            p_profile_id: rootId,
            p_amount_cents: rootAmountCents,
          });

          if (rootError) {
            console.error('[process-pending] Root commission error:', rootError);
          } else {
            console.log('[process-pending] Root commission paid:', { rootId, amountCents: rootAmountCents });
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

        console.log('[process-pending] Affiliate log recorded');
      }

      // Record transaction
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'registration',
        amount,
        platform_amount: amount, // Full amount goes to platform for registration
        status: 'completed',
        payment_method: payment.payment_method_id,
        external_id: externalRef,
        metadata: { event_type: eventType, direct_id: directId, root_id: rootId },
      });

      // Notify admins
      await notifyAdmins(
        'Novo cadastro pago (processado manualmente)',
        `Novo usuário registrado por R$ ${amount.toFixed(2)}`,
        'registration'
      );

      console.log('[process-pending] Registration completed:', userId);

    } else if (eventType === 'CREDITS_PURCHASE' || eventType === 'CREDITS') {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID missing in metadata' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const credits = metadata.credits || Math.round((amount / 5) * 180);
      
      // Update credits wallet
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
        platform_amount: amount,
        status: 'completed',
        payment_method: payment.payment_method_id,
        external_id: externalRef,
        metadata: { credits, event_type: eventType },
      });

      console.log('[process-pending] Credits added:', { userId, credits });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: eventType,
      paymentId,
      amount,
      metadata,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-pending] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
