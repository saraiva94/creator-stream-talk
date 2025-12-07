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

    // Check if email is already registered
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
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

    // If free registration (root creator), create user immediately
    if (free || root) {
      console.log('[registration] Free registration, creating user immediately');
      
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
        throw authError;
      }

      const userId = authData.user.id;

      // Update profile with referrer info
      await supabase
        .from('profiles')
        .update({
          referred_by: referrerId,
          username: fullName || email.split('@')[0],
          is_subscribed: true,
        })
        .eq('id', userId);

      // Sign in the user
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

    // For paid registration: DO NOT create user yet
    // Store registration data temporarily and create user only after payment is confirmed
    
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      throw new Error('Missing Mercado Pago access token');
    }

    const externalReference = crypto.randomUUID();
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Get origin from headers
    const origin = req.headers.get('origin') 
      || req.headers.get('referer')?.replace(/\/$/, '').split('/').slice(0, 3).join('/') 
      || 'https://streamstar.vercel.app';

    console.log('[registration] Detected origin:', origin);

    // Store pending registration data in metadata
    // User will be created only when payment is confirmed via webhook
    const registrationData = {
      email,
      password, // Will be used to create user after payment
      fullName,
      referrerId,
      rootId,
    };

    // Encrypt/encode the password for safe transmission in metadata
    const encodedPassword = btoa(password);

    const preference = {
      items: [
        {
          id: 'activation',
          title: 'StreamStar - Ativação de Conta',
          description: 'Ativação de conta e acesso completo à plataforma StreamStar',
          category_id: 'services',
          quantity: 1,
          unit_price: REGISTRATION_PRICE,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: email,
      },
      statement_descriptor: 'STREAMSTAR',
      metadata: {
        event_type: 'REGISTRATION',
        email,
        full_name: fullName,
        encoded_password: encodedPassword,
        direct_id: referrerId,
        root_id: rootId,
        payment_id: externalReference,
      },
      back_urls: {
        success: `${origin}/auth?pending=true`,
        failure: `${origin}/subscribe?error=payment_failed`,
        pending: `${origin}/subscribe?pending=true`,
      },
      auto_return: 'approved',
      external_reference: externalReference,
      notification_url: webhookUrl,
    };

    console.log('[registration] Creating MP preference (user will be created after payment):', { 
      webhookUrl, 
      externalReference,
      email,
    });

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
    console.log('[registration] MP preference created:', { 
      id: mpData.id, 
      init_point: mpData.init_point,
    });

    const initPoint = mpData.init_point || mpData.sandbox_init_point;
    if (!initPoint || !initPoint.startsWith('https://')) {
      console.error('[registration] Invalid init_point received:', initPoint);
      throw new Error('Invalid payment URL received from Mercado Pago');
    }

    return new Response(JSON.stringify({
      init_point: initPoint,
      preferenceId: mpData.id,
      paymentId: externalReference,
      amount: REGISTRATION_PRICE,
      // Indicate that user must complete payment to activate account
      status: 'pending_payment',
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
