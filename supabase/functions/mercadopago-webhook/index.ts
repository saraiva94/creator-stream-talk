import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('Mercado Pago webhook received:', payload);

    if (payload.type === 'payment') {
      const paymentId = payload.data.id;
      
      // Fetch payment details from Mercado Pago
      const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${mpToken}`
        }
      });
      
      const payment = await paymentResponse.json();
      console.log('Payment details:', payment);

      if (payment.status === 'approved') {
        const metadata = payment.metadata;
        const userId = metadata.user_id;
        const creatorId = metadata.creator_id;
        const type = metadata.type || 'subscription';
        const amount = payment.transaction_amount;

        // Calculate splits based on financial settings
        const { data: settings } = await supabase
          .from('financial_settings')
          .select('*')
          .single();

        const creatorPercentage = settings?.creator_percentage || 60;
        const platformPercentage = settings?.platform_percentage || 30;
        const affiliatePercentage = settings?.affiliate_percentage || 10;

        const creatorAmount = (amount * creatorPercentage) / 100;
        const platformAmount = (amount * platformPercentage) / 100;
        const affiliateAmount = (amount * affiliatePercentage) / 100;

        // Create transaction record
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            creator_id: creatorId,
            type,
            amount,
            creator_amount: creatorAmount,
            platform_amount: platformAmount,
            affiliate_amount: affiliateAmount,
            status: 'completed',
            payment_method: payment.payment_method_id,
            external_id: paymentId.toString(),
            metadata: payment.metadata
          });

        if (txError) {
          console.error('Error creating transaction:', txError);
          throw txError;
        }

        // Credit creator balance
        const { error: balanceError } = await supabase.rpc('increment_balance', {
          _user_id: creatorId,
          _amount: creatorAmount
        });

        if (balanceError) {
          console.error('Error updating creator balance:', balanceError);
        }

        // Update or create subscription
        if (type === 'subscription') {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          const { error: subError } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              creator_id: creatorId,
              status: 'active',
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString()
            }, {
              onConflict: 'user_id,creator_id'
            });

          if (subError) {
            console.error('Error updating subscription:', subError);
          }

          // Update profile subscription status
          await supabase
            .from('profiles')
            .update({ is_subscribed: true })
            .eq('id', userId);
        }

        console.log('Payment processed successfully');
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
