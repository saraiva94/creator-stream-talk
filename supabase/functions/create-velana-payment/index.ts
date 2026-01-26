import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Credit packages: credits -> price in cents
const CREDIT_PACKAGES: Record<number, number> = {
  180: 500,    // R$ 5.00 for 30 min
  360: 900,    // R$ 9.00 for 1 hour
  720: 1600,   // R$ 16.00 for 2 hours
  1800: 3500,  // R$ 35.00 for 5 hours
};

// SuperChat tiers
const SUPERCHAT_TIERS: Record<string, { amountCents: number; duration: number }> = {
  blue: { amountCents: 300, duration: 60 },
  yellow: { amountCents: 500, duration: 120 },
  red: { amountCents: 800, duration: 180 },
};

const REGISTRATION_PRICE_CENTS = 700; // R$ 7.00

// Velana API Base URL
const VELANA_API_BASE = 'https://api.velana.com.br';

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
      userId,
      purchaseType,
      credits,
      liveId,
      amount,
      description,
      // Customer info for PIX
      customerName,
      customerEmail,
      customerCpf,
      customerPhone,
      // Registration specific
      referrerId,
      rootId,
      // SuperChat specific
      roomId,
      creatorId,
      tier,
      message,
    } = body;

    console.log('[create-velana-payment] Request:', { userId, purchaseType, credits, liveId, tier });

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user profile for customer info if not provided
    let customer = {
      name: customerName,
      email: customerEmail,
      cpf: customerCpf,
      phone: customerPhone,
    };

    if (!customer.name || !customer.email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();

      const { data: authUser } = await supabase.auth.admin.getUserById(userId);

      customer.name = customer.name || profile?.username || 'Usuário';
      customer.email = customer.email || authUser?.user?.email || `${userId}@streamstar.app`;
    }

    // Determine payment amount and event type
    let paymentAmountCents = amount ? Math.round(amount * 100) : 0;
    let paymentDescription = description;
    let creditsToGrant = credits || 0;
    let eventType = 'LIVE_ACCESS';
    let metadata: Record<string, unknown> = {
      user_id: userId,
    };

    const normalizedPurchaseType = (purchaseType || '').toLowerCase();

    if (normalizedPurchaseType === 'credits' || normalizedPurchaseType === 'credits_purchase') {
      eventType = 'CREDITS_PURCHASE';
      creditsToGrant = credits || 180;
      paymentAmountCents = CREDIT_PACKAGES[creditsToGrant] || 500;
      paymentDescription = `${creditsToGrant} créditos - Stream Star`;
      metadata.credits = creditsToGrant;

    } else if (normalizedPurchaseType === 'registration') {
      eventType = 'REGISTRATION';
      paymentAmountCents = REGISTRATION_PRICE_CENTS;
      paymentDescription = 'Ativação de Conta - Stream Star';
      metadata.direct_id = referrerId || null;
      metadata.root_id = rootId || null;

    } else if (normalizedPurchaseType === 'superchat') {
      eventType = 'SUPERCHAT';
      const tierConfig = SUPERCHAT_TIERS[tier];
      if (!tierConfig) {
        return new Response(JSON.stringify({ error: 'Invalid tier' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      paymentAmountCents = tierConfig.amountCents;
      paymentDescription = `SuperChat ${tier.charAt(0).toUpperCase() + tier.slice(1)} - Stream Star`;
      metadata.room_id = roomId;
      metadata.creator_id = creatorId;
      metadata.tier = tier;
      metadata.duration = tierConfig.duration;
      metadata.message = message;

    } else if (liveId) {
      eventType = 'LIVE_ACCESS';
      // Get live price
      const { data: live } = await supabase
        .from('lives')
        .select('price, title')
        .eq('id', liveId)
        .single();

      paymentAmountCents = live?.price ? Math.round(live.price * 100) : (amount ? Math.round(amount * 100) : 500);
      paymentDescription = `Acesso: ${live?.title || 'Live'}`;
      metadata.live_id = liveId;
    }

    if (!paymentAmountCents || paymentAmountCents < 100) {
      return new Response(JSON.stringify({ error: 'Invalid payment amount (minimum R$ 1.00)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const externalReference = crypto.randomUUID();
    metadata.event_type = eventType;
    metadata.payment_id = externalReference;

    const webhookUrl = `${supabaseUrl}/functions/v1/velana-webhook`;

    // Fixed owner data for all PIX cash-in transactions
    // Users don't need to provide CPF or phone - platform owner data is used
    const OWNER_DATA = {
      cpf: '10285418726',
      name: 'Stream Star Pagamentos',
      phone: '12999999999', // Telefone fixo do owner (DDD + número, sem formatação)
    };

    const velanaPayload = {
      amount: paymentAmountCents,
      paymentMethod: 'pix',
      customer: {
        name: OWNER_DATA.name,
        email: customer.email,
        phone: OWNER_DATA.phone,
        document: {
          type: 'cpf',
          number: OWNER_DATA.cpf,
        },
      },
      items: [
        {
          externalRef: externalReference,
          title: paymentDescription || 'Stream Star',
          unitPrice: paymentAmountCents,
          quantity: 1,
          tangible: false,
        },
      ],
      pix: {
        expiresIn: 3600, // 1 hour
      },
      postbackUrl: webhookUrl,
      metadata: JSON.stringify(metadata),
      externalRef: externalReference,
    };

    console.log('[create-velana-payment] Creating Velana transaction:', {
      amount: paymentAmountCents,
      eventType,
      externalRef: externalReference,
    });

    // Call Velana API
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
      console.error('[create-velana-payment] Velana error:', velanaData);
      throw new Error(velanaData.message || velanaData.error || 'Velana API error');
    }

    // Log FULL Velana response for debugging
    console.log('[create-velana-payment] Velana FULL response:', JSON.stringify(velanaData, null, 2));

    // Extract PIX QR code data - Velana uses lowercase "qrcode" field
    const pixData = velanaData.pix || {};
    // The PIX copy-paste string is in pix.qrcode (lowercase!)
    const qrCode = pixData.qrcode || pixData.qrCode || pixData.qr_code || '';
    // Velana doesn't return a QR code image, so we leave it empty (frontend can generate from string)
    const qrCodeImage = pixData.qrCodeImage || pixData.qr_code_image || pixData.image || '';
    // Expiration date
    const expiresAt = pixData.expirationDate || pixData.expiresAt || pixData.expires_at || 
                      new Date(Date.now() + 3600000).toISOString();
    
    console.log('[create-velana-payment] Extracted PIX data:', {
      hasPixObject: !!velanaData.pix,
      qrCodeLength: qrCode?.length || 0,
      qrCodePreview: qrCode?.substring(0, 50) + '...',
      expiresAt,
      secureUrl: velanaData.secureUrl,
    });

    // Register payment_intent for tracking and realtime updates
    const { error: intentError } = await supabase
      .from('payment_intents')
      .insert({
        user_id: userId,
        external_ref: externalReference,
        velana_transaction_id: String(velanaData.id),
        purchase_type: normalizedPurchaseType || 'live_access',
        amount_cents: paymentAmountCents,
        status: 'pending',
        metadata: {
          ...metadata,
          credits: creditsToGrant || undefined,
          velana_status: velanaData.status,
        },
      });

    if (intentError) {
      console.error('[create-velana-payment] Failed to create payment_intent:', intentError);
      // Don't fail the request, just log the error
    } else {
      console.log('[create-velana-payment] Payment intent created:', externalReference);
    }

    return new Response(JSON.stringify({
      success: true,
      purchaseType: normalizedPurchaseType || 'live_access',
      transactionId: String(velanaData.id),
      externalRef: externalReference,
      paymentId: externalReference,
      amountCents: paymentAmountCents,
      amount: paymentAmountCents / 100,
      credits: creditsToGrant || undefined,
      eventType,
      secureUrl: velanaData.secureUrl,
      pix: {
        qrCode: qrCode || null,
        qrCodeImage: qrCodeImage || null,
        expiresAt: expiresAt,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[create-velana-payment] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
