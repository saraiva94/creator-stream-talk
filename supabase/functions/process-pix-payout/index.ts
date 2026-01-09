import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Process PIX Payout - Admin Endpoint
 * 
 * This function processes approved payout requests.
 * 
 * NOTE: Mercado Pago does NOT have a direct PIX disbursement API.
 * Options for production:
 * 
 * 1. MANUAL PROCESSING (Current implementation)
 *    - Admin approves request
 *    - Admin manually transfers via Mercado Pago dashboard or bank
 *    - Admin marks as paid in system
 * 
 * 2. MERCADO PAGO SPLIT PAYMENTS (Alternative)
 *    - Configure split at payment time
 *    - Requires seller accounts for each creator
 * 
 * 3. THIRD-PARTY BANKING API (Production recommended)
 *    - Use banking APIs like:
 *      - Transfeera (PIX disbursement API)
 *      - Celcoin
 *      - Banco Inter API
 *      - Nubank Business API
 *    - These provide direct PIX transfer capabilities
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { payoutId, action, transactionId, notes } = await req.json();

    console.log('[process-payout] Request:', { payoutId, action, adminId: user.id });

    if (!payoutId || !action) {
      return new Response(JSON.stringify({ error: 'payoutId and action required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get payout request
    const { data: payout, error: payoutError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (payoutError || !payout) {
      return new Response(JSON.stringify({ error: 'Payout request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payout.status !== 'pending' && payout.status !== 'approved') {
      return new Response(JSON.stringify({ 
        error: `Cannot process payout with status: ${payout.status}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let adminNotes: Record<string, unknown> = {};
    try {
      adminNotes = payout.admin_notes ? JSON.parse(payout.admin_notes) : {};
    } catch {
      // Se não for JSON, mantém como string no objeto
      adminNotes = { originalNotes: payout.admin_notes };
    }

    // Action: Reprocess via Velana API
    if (action === 'reprocess_velana') {
      const VELANA_API_KEY = Deno.env.get('VELANA_API_KEY');
      const VELANA_BASE_URL = 'https://api.velana.com.br';
      
      // Helper para Basic Auth
      const getVelanaAuthHeader = (apiKey: string): string => {
        const credentials = `${apiKey}:x`;
        return `Basic ${btoa(credentials)}`;
      };

      if (!VELANA_API_KEY) {
        return new Response(JSON.stringify({ 
          error: 'VELANA_API_KEY não configurada no servidor' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const amountBRL = payout.amount;
      const correlationId = payout.idempotency_key || crypto.randomUUID();

      const velanaPayload = {
        amount: amountBRL,
        pixKey: payout.pix_key,
        pixKeyType: payout.pix_key_type,
        description: 'Saque Stream Live Hub',
        externalId: correlationId,
      };

      console.log('[process-payout] Reprocessing via Velana:', velanaPayload);

      try {
        const velanaResponse = await fetch(`${VELANA_BASE_URL}/v1/pix/transfers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getVelanaAuthHeader(VELANA_API_KEY),
          },
          body: JSON.stringify(velanaPayload),
        });

        const velanaData = await velanaResponse.json();
        console.log('[process-payout] Velana response:', { 
          status: velanaResponse.status, 
          data: velanaData 
        });

        if (velanaResponse.ok) {
          // Sucesso - atualizar payout
          await supabase
            .from('payout_requests')
            .update({
              status: 'approved',
              approved_by: user.id,
              approved_at: new Date().toISOString(),
              psp_transaction_id: velanaData.id,
              psp_response: velanaData,
              admin_notes: `Reprocessado via Velana por admin em ${new Date().toISOString()}`,
            })
            .eq('id', payoutId);

          // Notificar usuário
          await supabase.from('notifications').insert({
            user_id: payout.creator_id,
            title: '💰 Saque processado!',
            message: `Seu saque de R$ ${payout.amount.toFixed(2)} foi processado via PIX automaticamente.`,
            type: 'withdrawal_completed',
          });

          return new Response(JSON.stringify({
            success: true,
            status: 'approved',
            velanaTransactionId: velanaData.id,
            message: 'Saque processado via Velana com sucesso!',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Falha na Velana
          await supabase
            .from('payout_requests')
            .update({
              psp_response: velanaData,
              admin_notes: `Reprocessamento Velana falhou: ${velanaData.message || JSON.stringify(velanaData)}`,
            })
            .eq('id', payoutId);

          return new Response(JSON.stringify({
            success: false,
            error: velanaData.message || 'Erro na API Velana',
            velanaResponse: velanaData,
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (velanaError) {
        console.error('[process-payout] Velana error:', velanaError);
        return new Response(JSON.stringify({
          success: false,
          error: velanaError instanceof Error ? velanaError.message : 'Erro de conexão com Velana',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'approve') {
      // Approve the payout (mark as ready for payment)
      await supabase
        .from('payout_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          admin_notes: JSON.stringify({
            ...adminNotes,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            approval_notes: notes,
          }),
        })
        .eq('id', payoutId);

      // Notify user
      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '✅ Saque aprovado',
        message: `Seu saque de R$ ${payout.amount.toFixed(2)} foi aprovado e será processado em breve.`,
        type: 'withdrawal_approved',
      });

      console.log('[process-payout] Approved:', payoutId);

      return new Response(JSON.stringify({
        success: true,
        status: 'approved',
        message: 'Saque aprovado. Realize a transferência PIX manualmente.',
        pixDetails: {
          key: payout.pix_key,
          keyType: payout.pix_key_type,
          amount: payout.amount,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'complete') {
      // Mark as paid (after manual transfer)
      await supabase
        .from('payout_requests')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          admin_notes: JSON.stringify({
            ...adminNotes,
            paid_by: user.id,
            paid_at: new Date().toISOString(),
            transaction_id: transactionId,
            payment_notes: notes,
          }),
        })
        .eq('id', payoutId);

      // Update transaction status
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('external_id', payoutId);

      // Notify user
      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '💰 Saque realizado',
        message: `Seu saque de R$ ${payout.amount.toFixed(2)} foi transferido para sua conta PIX.`,
        type: 'withdrawal_completed',
      });

      console.log('[process-payout] Completed:', payoutId);

      return new Response(JSON.stringify({
        success: true,
        status: 'paid',
        message: 'Saque marcado como pago.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'reject') {
      // Reject and refund balance
      const amountCents = Math.round(payout.amount * 100);

      // Refund to creator_wallet first, then affiliate_earnings
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
      } else {
        // Fallback to affiliate_earnings
        const { data: profile } = await supabase
          .from('profiles')
          .select('affiliate_earnings')
          .eq('id', payout.creator_id)
          .single();

        await supabase
          .from('profiles')
          .update({ affiliate_earnings: (profile?.affiliate_earnings || 0) + amountCents })
          .eq('id', payout.creator_id);
      }

      await supabase
        .from('payout_requests')
        .update({
          status: 'rejected',
          failure_reason: notes,
          admin_notes: JSON.stringify({
            ...adminNotes,
            rejected_by: user.id,
            rejected_at: new Date().toISOString(),
            rejection_reason: notes,
          }),
        })
        .eq('id', payoutId);

      // Update transaction
      await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('metadata->payout_request_id', payoutId);

      // Notify user
      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '❌ Saque rejeitado',
        message: `Seu saque foi rejeitado. Motivo: ${notes || 'Não especificado'}. O valor foi devolvido ao seu saldo.`,
        type: 'withdrawal_rejected',
      });

      console.log('[process-payout] Rejected:', payoutId);

      return new Response(JSON.stringify({
        success: true,
        status: 'rejected',
        message: 'Saque rejeitado e saldo devolvido.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[process-payout] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
