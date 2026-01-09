// supabase/functions/reconcile-transfers/index.ts
// Reconciliação de transferências Velana - GET /v1/transfers/{id}
// Usado para verificar status quando webhook falha

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VELANA_API_KEY = Deno.env.get('VELANA_API_KEY');
const VELANA_BASE_URL = 'https://api.velana.com.br';

function getVelanaAuthHeader(apiKey: string): string {
  const credentials = `${apiKey}:x`;
  return `Basic ${btoa(credentials)}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Valida autenticação (só admin pode chamar)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autenticação necessária' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verifica se é admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Acesso negado - apenas admins' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await req.json();
    const { payoutId, transferId, reconcileAll } = body;

    if (!VELANA_API_KEY) {
      return new Response(JSON.stringify({ error: 'VELANA_API_KEY não configurada' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const results: any[] = [];

    if (reconcileAll) {
      // Reconcilia todas as transferências pendentes/processing
      const { data: pendingPayouts } = await supabase
        .from('payout_requests')
        .select('*')
        .in('status', ['processing', 'approved', 'pending'])
        .not('psp_transaction_id', 'is', null);

      if (pendingPayouts && pendingPayouts.length > 0) {
        for (const payout of pendingPayouts) {
          const result = await reconcileSingleTransfer(supabase, payout);
          results.push(result);
        }
      }
    } else if (transferId) {
      // Reconcilia por transferId da Velana
      const { data: payout } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('psp_transaction_id', transferId)
        .maybeSingle();

      if (payout) {
        const result = await reconcileSingleTransfer(supabase, payout);
        results.push(result);
      } else {
        // Tenta buscar direto na Velana
        const velanaResult = await fetchVelanaTransfer(transferId);
        results.push({ transferId, velanaResult, status: 'not_linked' });
      }
    } else if (payoutId) {
      // Reconcilia por payoutId interno
      const { data: payout } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('id', payoutId)
        .maybeSingle();

      if (!payout) {
        return new Response(JSON.stringify({ error: 'Payout não encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (!payout.psp_transaction_id) {
        return new Response(JSON.stringify({ 
          error: 'Payout não possui transferId da Velana',
          payout: { id: payout.id, status: payout.status }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const result = await reconcileSingleTransfer(supabase, payout);
      results.push(result);
    } else {
      return new Response(JSON.stringify({ error: 'Informe payoutId, transferId ou reconcileAll' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('[reconcile-transfers] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

async function fetchVelanaTransfer(transferId: string): Promise<any> {
  try {
    const response = await fetch(`${VELANA_BASE_URL}/v1/transfers/${transferId}`, {
      method: 'GET',
      headers: {
        'Authorization': getVelanaAuthHeader(VELANA_API_KEY!),
      },
    });

    const responseText = await response.text();
    try {
      return JSON.parse(responseText);
    } catch {
      return { error: 'Invalid JSON', raw: responseText.substring(0, 200) };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Fetch error' };
  }
}

async function reconcileSingleTransfer(supabase: any, payout: any): Promise<any> {
  const transferId = payout.psp_transaction_id;
  
  console.log('[reconcile-transfers] Fetching Velana transfer:', transferId);
  
  const velanaData = await fetchVelanaTransfer(transferId);
  
  if (velanaData.error) {
    return {
      payoutId: payout.id,
      transferId,
      status: 'error',
      error: velanaData.error,
    };
  }

  const velanaStatus = velanaData.status;
  let newStatus = payout.status;
  let updated = false;

  // Mapeia status Velana para interno
  if (velanaStatus === 'success') {
    if (payout.status !== 'paid') {
      newStatus = 'paid';
      updated = true;
      
      await supabase
        .from('payout_requests')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          psp_response: velanaData,
        })
        .eq('id', payout.id);

      // Limpa pending
      const { data: wallet } = await supabase
        .from('creator_wallet')
        .select('pending_cents')
        .eq('creator_id', payout.creator_id)
        .maybeSingle();

      if (wallet) {
        const amountCents = Math.round(payout.amount * 100);
        await supabase
          .from('creator_wallet')
          .update({
            pending_cents: Math.max(0, (wallet.pending_cents || 0) - amountCents),
          })
          .eq('creator_id', payout.creator_id);
      }

      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '💰 Saque concluído!',
        message: `Seu saque de R$ ${payout.amount.toFixed(2)} foi depositado via PIX.`,
        type: 'withdrawal_completed',
      });
    }
  } else if (velanaStatus === 'failed') {
    if (payout.status !== 'failed') {
      newStatus = 'failed';
      updated = true;
      
      const amountCents = Math.round(payout.amount * 100);
      
      await supabase
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: velanaData.failureReason || 'Falha no processamento',
          psp_response: velanaData,
        })
        .eq('id', payout.id);

      // Estorna saldo
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
      }

      await supabase.from('notifications').insert({
        user_id: payout.creator_id,
        title: '❌ Saque falhou',
        message: `Seu saque de R$ ${payout.amount.toFixed(2)} não pôde ser processado. O valor foi devolvido.`,
        type: 'withdrawal_failed',
      });
    }
  } else if (velanaStatus === 'bank_processing' || velanaStatus === 'pending') {
    if (payout.status !== 'processing') {
      newStatus = 'processing';
      updated = true;
      
      await supabase
        .from('payout_requests')
        .update({
          status: 'processing',
          psp_response: velanaData,
        })
        .eq('id', payout.id);
    }
  }

  return {
    payoutId: payout.id,
    transferId,
    previousStatus: payout.status,
    velanaStatus,
    newStatus,
    updated,
    velanaData,
  };
}
