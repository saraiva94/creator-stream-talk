// supabase/functions/activate-pending-registration/index.ts
// Admin function to manually activate a pending registration

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { email, payment_id } = await req.json();

    if (!email && !payment_id) {
      return new Response(
        JSON.stringify({ error: 'email or payment_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the pending registration
    let query = supabase
      .from('registration_referrals')
      .select('*')
      .eq('status', 'pending');

    if (email) {
      query = query.eq('email', email);
    } else if (payment_id) {
      query = query.eq('payment_id', payment_id);
    }

    const { data: pendingReg, error: findError } = await query.maybeSingle();

    if (findError || !pendingReg) {
      return new Response(
        JSON.stringify({ error: 'Pending registration not found', details: findError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[activate-pending] Found registration:', pendingReg);

    // Decode password from base64
    const password = atob(pendingReg.password_hash);
    const username = pendingReg.username;
    const regEmail = pendingReg.email;
    const directId = pendingReg.referrer_id;
    const rootId = pendingReg.referrer_parent_id;
    const isRootCreator = pendingReg.is_root_creator;

    // Create user in auth.users
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: regEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        referrer_id: directId,
      },
    });

    if (createError) {
      console.error('[activate-pending] Failed to create user:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = newUser.user?.id;
    if (!newUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID not returned after creation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[activate-pending] User created:', newUserId);

    // Update profile
    await supabase
      .from('profiles')
      .update({
        username,
        status: 'active',
        is_subscribed: true,
        is_root_creator: isRootCreator,
        referred_by: directId,
        referrer_direct: directId,
        referrer_root: rootId,
      })
      .eq('id', newUserId);

    // Mark registration as completed
    await supabase
      .from('registration_referrals')
      .update({
        user_id: newUserId,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', pendingReg.id);

    // Create affiliate log entry (comissions already credited previously)
    const directAmountCents = directId ? 100 : 0;
    const rootAmountCents = rootId && rootId !== directId ? 50 : 0;
    const platformAmountCents = 500 - directAmountCents - rootAmountCents;

    // Record in transactions
    await supabase.from('transactions').insert({
      user_id: newUserId,
      type: 'registration',
      amount: 5.0,
      platform_amount: platformAmountCents / 100,
      status: 'completed',
      payment_method: 'pix_velana',
      external_id: pendingReg.payment_id,
      metadata: { 
        event_type: 'REGISTRATION', 
        direct_id: directId, 
        root_id: rootId,
        activated_manually: true,
      },
    });

    // Platform revenue record
    await supabase.from('platform_revenue').insert({
      source_type: 'registration',
      source_id: pendingReg.payment_id,
      amount: platformAmountCents,
      user_id: newUserId,
      metadata: { direct_id: directId, root_id: rootId, gross_amount: 500, manual_activation: true },
    });

    console.log('[activate-pending] Registration activated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUserId,
        email: regEmail,
        username,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[activate-pending] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
