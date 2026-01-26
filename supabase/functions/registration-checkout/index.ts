// supabase/functions/registration-checkout/index.ts
// Creates a pending registration and generates PIX payment
// User account is created ONLY after payment confirmation via webhook

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REGISTRATION_PRICE_CENTS = 700; // R$ 7.00
const VELANA_API_BASE = 'https://api.velana.com.br';

// Fixed owner data for all PIX cash-in transactions
const OWNER_DATA = {
  cpf: '10285418726',
  name: 'Stream Star Pagamentos',
  phone: '12999999999',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const velanaApiKey = Deno.env.get('VELANA_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!velanaApiKey) {
      throw new Error('VELANA_API_KEY not configured');
    }

    const body = await req.json();
    const {
      email,
      password,
      username,
      referralCode,
      referrerId,
    } = body;

    console.log('[registration-checkout] Request:', { email, username, referralCode, referrerId });

    // Validate required fields
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email already exists in auth.users
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('[registration-checkout] Error listing users:', listError);
    } else {
      const emailExists = existingUsers.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        return new Response(JSON.stringify({ error: 'Este email já está cadastrado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if email has a pending registration
    const { data: pendingReg } = await supabase
      .from('registration_referrals')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingReg) {
      // Clean up old pending registration
      await supabase
        .from('registration_referrals')
        .delete()
        .eq('id', pendingReg.id);
    }

    // Resolve referral context
    let directId: string | null = null;
    let rootId: string | null = null;

    if (referrerId) {
      directId = referrerId;
      // Get parent referrer
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('referrer_direct, referrer_root, is_root_creator')
        .eq('id', referrerId)
        .maybeSingle();
      
      if (referrerProfile) {
        // Parent's root is our root, or parent is root if they're a root creator
        rootId = referrerProfile.is_root_creator ? referrerId : (referrerProfile.referrer_root || referrerProfile.referrer_direct || null);
      }
    } else if (referralCode) {
      // Validate referral code
      const { data: codeOwner } = await supabase
        .from('profiles')
        .select('id, referrer_direct, referrer_root, is_root_creator')
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();
      
      if (codeOwner) {
        directId = codeOwner.id;
        rootId = codeOwner.is_root_creator ? codeOwner.id : (codeOwner.referrer_root || codeOwner.referrer_direct || null);
      }
    }

    const isRootCreator = !directId; // No referrer = root creator
    const paymentId = crypto.randomUUID();

    // Hash the password for secure storage (will be used when creating user)
    // We use a simple base64 encoding here - the password will be used with admin.createUser
    const passwordEncoded = btoa(password);

    // Create pending registration record
    const { error: insertError } = await supabase
      .from('registration_referrals')
      .insert({
        payment_id: paymentId,
        user_id: paymentId, // Temporary - will be updated with real user ID after payment
        email: email.toLowerCase(),
        username: username || email.split('@')[0],
        password_hash: passwordEncoded,
        referrer_id: directId,
        referrer_parent_id: rootId,
        is_root_creator: isRootCreator,
        is_free: false,
        status: 'pending',
        registration_data: {
          email: email.toLowerCase(),
          username: username || email.split('@')[0],
          direct_id: directId,
          root_id: rootId,
          is_root_creator: isRootCreator,
          referral_code: referralCode || null,
        },
      });

    if (insertError) {
      console.error('[registration-checkout] Error creating pending registration:', insertError);
      throw new Error('Erro ao iniciar registro');
    }

    // Create PIX payment via Velana
    const webhookUrl = `${supabaseUrl}/functions/v1/velana-webhook`;

    const metadata = {
      event_type: 'REGISTRATION',
      payment_id: paymentId,
      email: email.toLowerCase(),
      direct_id: directId,
      root_id: rootId,
      is_root_creator: isRootCreator,
    };

    const velanaPayload = {
      amount: REGISTRATION_PRICE_CENTS,
      paymentMethod: 'pix',
      customer: {
        name: OWNER_DATA.name,
        email: email,
        phone: OWNER_DATA.phone,
        document: {
          type: 'cpf',
          number: OWNER_DATA.cpf,
        },
      },
      items: [
        {
          externalRef: paymentId,
          title: 'Ativação de Conta - Stream Star',
          unitPrice: REGISTRATION_PRICE_CENTS,
          quantity: 1,
          tangible: false,
        },
      ],
      pix: {
        expiresIn: 3600, // 1 hour
      },
      postbackUrl: webhookUrl,
      metadata: JSON.stringify(metadata),
      externalRef: paymentId,
    };

    console.log('[registration-checkout] Creating Velana payment:', { paymentId, email, directId, rootId });

    const authHeader = 'Basic ' + btoa(`${velanaApiKey}:x`);

    const velanaResponse = await fetch(`${VELANA_API_BASE}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(velanaPayload),
    });

    const velanaData = await velanaResponse.json();

    if (!velanaResponse.ok) {
      console.error('[registration-checkout] Velana error:', velanaData);
      // Clean up pending registration on failure
      await supabase
        .from('registration_referrals')
        .delete()
        .eq('payment_id', paymentId);
      throw new Error(velanaData.message || velanaData.error || 'Erro ao criar pagamento PIX');
    }

    console.log('[registration-checkout] Velana response:', JSON.stringify(velanaData, null, 2));

    // Extract PIX data
    const pixData = velanaData.pix || {};
    const qrCode = pixData.qrcode || pixData.qrCode || pixData.qr_code || '';
    const qrCodeImage = pixData.qrCodeImage || pixData.qr_code_image || pixData.image || '';
    const expiresAt = pixData.expirationDate || pixData.expiresAt || pixData.expires_at || 
                      new Date(Date.now() + 3600000).toISOString();

    // Create payment_intent for tracking
    await supabase
      .from('payment_intents')
      .insert({
        user_id: paymentId, // Temporary ID - will be associated with real user after creation
        external_ref: paymentId,
        velana_transaction_id: String(velanaData.id),
        purchase_type: 'registration',
        amount_cents: REGISTRATION_PRICE_CENTS,
        status: 'pending',
        metadata: {
          ...metadata,
          velana_status: velanaData.status,
        },
      });

    console.log('[registration-checkout] Payment created successfully:', { paymentId, transactionId: velanaData.id });

    return new Response(JSON.stringify({
      success: true,
      paymentId,
      transactionId: String(velanaData.id),
      externalRef: paymentId,
      amount: REGISTRATION_PRICE_CENTS / 100,
      pix: {
        qrCode: qrCode || null,
        qrCodeImage: qrCodeImage || null,
        expiresAt: expiresAt,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[registration-checkout] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
