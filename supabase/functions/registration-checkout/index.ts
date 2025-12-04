import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REGISTRATION_PRICE = 5.00;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { fullName, email, password, referralCode, acceptTerms, free, root } = await req.json();

    console.log('[registration] Starting checkout:', { email, referralCode, free, root });

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!acceptTerms) {
      return new Response(JSON.stringify({ error: 'You must accept the terms' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate referral code
    let referrerId: string | null = null;
    let rootId: string | null = null;

    if (referralCode) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, referred_by')
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();

      if (!referrer) {
        return new Response(JSON.stringify({ error: 'Invalid referral code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      referrerId = referrer.id;
      rootId = referrer.referred_by || null;
      console.log('[registration] Found referrer:', { referrerId, rootId });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        referrer_id: referrerId,
      },
    });

    if (authError) {
      console.error('[registration] Auth error:', authError);
      if (authError.message.includes('already')) {
        return new Response(JSON.stringify({ error: 'Email already registered' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw authError;
    }

    const userId = authData.user.id;
    console.log('[registration] Created user:', userId);

    // Update profile with referrer info
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        referred_by: referrerId,
        username: fullName || email.split('@')[0],
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[registration] Profile update error:', profileError);
    }

    // If free registration (root creator), skip payment
    if (free || root) {
      console.log('[registration] Free registration, generating session');
      
      const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

      // Sign in the user directly
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[registration] Sign-in error:', signInError);
      }

      return new Response(JSON.stringify({
        status: 'active',
        profileId: userId,
        token: signInData?.session?.access_token || null,
        refresh_token: signInData?.session?.refresh_token || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Mercado Pago preference for paid registration
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      throw new Error('Missing Mercado Pago access token');
    }

    const externalReference = crypto.randomUUID();
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const preference = {
      items: [
        {
          title: 'Taxa de Ativação - Stream Live Hub',
          description: 'Ativação de conta e acesso completo à plataforma',
          quantity: 1,
          unit_price: REGISTRATION_PRICE,
          currency_id: 'BRL',
        },
      ],
      metadata: {
        event_type: 'REGISTRATION',
        user_id: userId,
        email,
        direct_id: referrerId,
        root_id: rootId,
        payment_id: externalReference,
      },
      back_urls: {
        success: `${req.headers.get('origin') || 'https://enacciilzvifhqpenhlz.lovableproject.com'}/dashboard`,
        failure: `${req.headers.get('origin') || 'https://enacciilzvifhqpenhlz.lovableproject.com'}/subscribe`,
        pending: `${req.headers.get('origin') || 'https://enacciilzvifhqpenhlz.lovableproject.com'}/subscribe`,
      },
      auto_return: 'approved',
      external_reference: externalReference,
      notification_url: webhookUrl,
    };

    console.log('[registration] Creating MP preference:', { webhookUrl, externalReference });

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('[registration] MP error:', errorText);
      throw new Error(`Mercado Pago error: ${errorText}`);
    }

    const mpData = await mpResponse.json();
    console.log('[registration] MP preference created:', mpData.id);

    return new Response(JSON.stringify({
      init_point: mpData.init_point,
      preferenceId: mpData.id,
      paymentId: externalReference,
      amount: REGISTRATION_PRICE,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[registration] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
