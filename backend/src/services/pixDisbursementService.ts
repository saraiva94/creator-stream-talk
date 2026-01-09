/**
 * Serviço de Saques via PIX
 * 
 * Centraliza toda a lógica de saques PIX usando a Velana como PSP.
 * Garante consistência do ledger e tratamento correto de falhas.
 */

import { supabaseAdmin } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { VELANA_CONSTANTS } from '../config/velanaConfig';
import { createPixTransfer, detectPixKeyType, type PixKeyType } from './velanaPixService';
import {
  recordWithdrawalHold,
  recordWithdrawalRelease,
  recordWithdrawalRefund,
} from './walletLedgerService';

export interface PixWithdrawalParams {
  userId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType?: string;
  sourceType: 'creator' | 'affiliate';
  idempotencyKey?: string;
}

export interface PixWithdrawalResult {
  success: boolean;
  payoutRequestId?: string;
  status?: string;
  message: string;
  pspTransactionId?: string;
}

interface PayoutRequest {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  pix_key: string;
  pix_key_type: string | null;
  source_type: string;
  psp_transaction_id: string | null;
  psp_response: Record<string, unknown> | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  created_at: string;
}

/**
 * Máscara chave PIX para logs
 */
function maskPixKey(pixKey: string): string {
  if (pixKey.length <= 6) return '***';
  return `${pixKey.substring(0, 3)}***${pixKey.substring(pixKey.length - 3)}`;
}

/**
 * Verifica se há saque recente com mesmos parâmetros (idempotência)
 */
async function checkRecentDuplicate(
  userId: string,
  amountCents: number,
  idempotencyKey?: string
): Promise<PayoutRequest | null> {
  // Se tem chave de idempotência, busca por ela
  if (idempotencyKey) {
    const { data } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    
    if (data) return data as PayoutRequest;
  }

  // Busca por saque recente com mesmos parâmetros (janela de 60 segundos)
  const windowStart = new Date(Date.now() - VELANA_CONSTANTS.IDEMPOTENCY_WINDOW_SECONDS * 1000).toISOString();
  
  const { data } = await supabaseAdmin
    .from('payout_requests')
    .select('*')
    .eq('creator_id', userId)
    .eq('amount', amountCents)
    .gte('created_at', windowStart)
    .in('status', ['pending', 'processing', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as PayoutRequest | null;
}

/**
 * Obtém saldo disponível do usuário
 */
async function getAvailableBalance(
  userId: string,
  sourceType: 'creator' | 'affiliate'
): Promise<number> {
  if (sourceType === 'creator') {
    const { data } = await supabaseAdmin
      .from('creator_wallet')
      .select('balance_cents')
      .eq('creator_id', userId)
      .maybeSingle();
    
    return data?.balance_cents || 0;
  } else {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('affiliate_earnings')
      .eq('id', userId)
      .maybeSingle();
    
    return data?.affiliate_earnings || 0;
  }
}

/**
 * Debita saldo da wallet (hold)
 */
async function debitWalletBalance(
  userId: string,
  amountCents: number,
  sourceType: 'creator' | 'affiliate'
): Promise<number> {
  if (sourceType === 'creator') {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('creator_wallet')
      .select('balance_cents, pending_cents')
      .eq('creator_id', userId)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet não encontrada');
    }

    const newBalance = (wallet.balance_cents || 0) - amountCents;
    const newPending = (wallet.pending_cents || 0) + amountCents;

    const { error: updateError } = await supabaseAdmin
      .from('creator_wallet')
      .update({
        balance_cents: newBalance,
        pending_cents: newPending,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', userId);

    if (updateError) {
      throw new Error(`Falha ao debitar saldo: ${updateError.message}`);
    }

    return newBalance;
  } else {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('affiliate_earnings')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil não encontrado');
    }

    const newBalance = (profile.affiliate_earnings || 0) - amountCents;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        affiliate_earnings: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Falha ao debitar saldo: ${updateError.message}`);
    }

    return newBalance;
  }
}

/**
 * Credita saldo de volta (refund)
 */
async function creditWalletBalance(
  userId: string,
  amountCents: number,
  sourceType: 'creator' | 'affiliate'
): Promise<number> {
  if (sourceType === 'creator') {
    const { data: wallet } = await supabaseAdmin
      .from('creator_wallet')
      .select('balance_cents, pending_cents')
      .eq('creator_id', userId)
      .single();

    const newBalance = (wallet?.balance_cents || 0) + amountCents;
    const newPending = Math.max(0, (wallet?.pending_cents || 0) - amountCents);

    await supabaseAdmin
      .from('creator_wallet')
      .update({
        balance_cents: newBalance,
        pending_cents: newPending,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', userId);

    return newBalance;
  } else {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('affiliate_earnings')
      .eq('id', userId)
      .single();

    const newBalance = (profile?.affiliate_earnings || 0) + amountCents;

    await supabaseAdmin
      .from('profiles')
      .update({
        affiliate_earnings: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return newBalance;
  }
}

/**
 * Processa saque via PIX usando Velana
 */
export async function sendPixPaymentViaVelana(
  params: PixWithdrawalParams
): Promise<PixWithdrawalResult> {
  const {
    userId,
    amountCents,
    pixKey,
    pixKeyType,
    sourceType,
    idempotencyKey,
  } = params;

  const detectedPixKeyType = (pixKeyType?.toUpperCase() as PixKeyType) || detectPixKeyType(pixKey);
  const walletType = sourceType === 'creator' ? 'creator' : 'affiliate';

  logger.info('[PixDisbursement] Processing withdrawal request via Velana', {
    userId,
    amountCents,
    pixKey: maskPixKey(pixKey),
    sourceType,
  });

  // 1. Validar valor mínimo
  if (amountCents < VELANA_CONSTANTS.MIN_WITHDRAW_CENTS) {
    return {
      success: false,
      message: `Valor mínimo para saque é de R$ ${(VELANA_CONSTANTS.MIN_WITHDRAW_CENTS / 100).toFixed(2)}`,
    };
  }

  // 2. Verificar idempotência
  const existingPayout = await checkRecentDuplicate(userId, amountCents, idempotencyKey);
  if (existingPayout) {
    logger.warn('[PixDisbursement] Duplicate request detected', {
      existingId: existingPayout.id,
      status: existingPayout.status,
    });
    
    return {
      success: true,
      payoutRequestId: existingPayout.id,
      status: existingPayout.status,
      message: 'Solicitação de saque já em processamento',
      pspTransactionId: existingPayout.psp_transaction_id || undefined,
    };
  }

  // 3. Verificar saldo disponível
  const availableBalance = await getAvailableBalance(userId, sourceType);
  if (availableBalance < amountCents) {
    logger.warn('[PixDisbursement] Insufficient balance', {
      userId,
      requested: amountCents,
      available: availableBalance,
    });
    
    return {
      success: false,
      message: 'Saldo insuficiente para saque',
    };
  }

  // 4. Gerar correlationId único para rastreamento
  const correlationId = idempotencyKey || crypto.randomUUID();

  // 5. Debitar saldo (hold)
  let newBalance: number;
  try {
    newBalance = await debitWalletBalance(userId, amountCents, sourceType);
  } catch (error) {
    logger.error('[PixDisbursement] Failed to debit balance', { error, userId });
    return {
      success: false,
      message: 'Falha ao processar débito do saldo',
    };
  }

  // 6. Criar payout_request
  const { data: payoutRequest, error: payoutError } = await supabaseAdmin
    .from('payout_requests')
    .insert({
      creator_id: userId,
      amount: amountCents,
      pix_key: pixKey,
      pix_key_type: detectedPixKeyType,
      source_type: sourceType,
      status: 'processing',
      idempotency_key: correlationId,
    })
    .select()
    .single();

  if (payoutError || !payoutRequest) {
    // Reverter débito
    await creditWalletBalance(userId, amountCents, sourceType);
    
    logger.error('[PixDisbursement] Failed to create payout request', { error: payoutError });
    return {
      success: false,
      message: 'Falha ao criar solicitação de saque',
    };
  }

  // 7. Registrar hold no ledger
  try {
    await recordWithdrawalHold(
      walletType,
      userId,
      amountCents,
      newBalance,
      payoutRequest.id
    );
  } catch (error) {
    logger.error('[PixDisbursement] Failed to record ledger entry', { error });
    // Continua mesmo se falhar o log do ledger
  }

  // 8. Chamar API da Velana
  try {
    const velanaResponse = await createPixTransfer({
      userId,
      amountCents,
      pixKey,
      pixKeyType: detectedPixKeyType,
      correlationId,
      description: `Saque Stream Live Hub - ${payoutRequest.id.substring(0, 8)}`,
    });

    if (!velanaResponse.success) {
      // Falha na Velana - reverter tudo
      logger.error('[PixDisbursement] Velana call failed', { error: velanaResponse.error, payoutId: payoutRequest.id });

      const refundedBalance = await creditWalletBalance(userId, amountCents, sourceType);

      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: velanaResponse.error || 'Erro ao processar PIX',
          psp_response: velanaResponse.rawResponse as Record<string, unknown> || null,
        })
        .eq('id', payoutRequest.id);

      try {
        await recordWithdrawalRefund(
          walletType,
          userId,
          amountCents,
          refundedBalance,
          payoutRequest.id,
          'Falha na comunicação com PSP'
        );
      } catch (ledgerError) {
        logger.error('[PixDisbursement] Failed to record refund in ledger', { error: ledgerError });
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'withdrawal',
        title: 'Falha no saque',
        message: `Seu saque de R$ ${(amountCents / 100).toFixed(2)} falhou. O valor foi devolvido ao seu saldo.`,
      });

      return {
        success: false,
        payoutRequestId: payoutRequest.id,
        status: 'failed',
        message: 'Falha ao processar saque. Valor devolvido ao saldo.',
      };
    }

    // 9. Atualizar payout_request com resposta do PSP
    await supabaseAdmin
      .from('payout_requests')
      .update({
        psp_transaction_id: velanaResponse.transferId || correlationId,
        psp_response: velanaResponse.rawResponse as Record<string, unknown>,
        status: 'processing', // Aguarda webhook para confirmar
      })
      .eq('id', payoutRequest.id);

    logger.info('[PixDisbursement] PIX payment sent to Velana', {
      payoutId: payoutRequest.id,
      transferId: velanaResponse.transferId,
      status: velanaResponse.status,
    });

    // Enviar notificação ao usuário
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'withdrawal',
      title: 'Saque em processamento',
      message: `Seu saque de R$ ${(amountCents / 100).toFixed(2)} está sendo processado via PIX.`,
    });

    return {
      success: true,
      payoutRequestId: payoutRequest.id,
      status: 'processing',
      message: 'Saque enviado para processamento',
      pspTransactionId: velanaResponse.transferId || correlationId,
    };
  } catch (error) {
    // Falha ao chamar PSP - reverter tudo
    logger.error('[PixDisbursement] Velana call exception, reverting', { error, payoutId: payoutRequest.id });

    // Reverter débito
    const refundedBalance = await creditWalletBalance(userId, amountCents, sourceType);

    // Atualizar payout_request como falha
    await supabaseAdmin
      .from('payout_requests')
      .update({
        status: 'failed',
        failure_reason: error instanceof Error ? error.message : 'Erro ao processar PIX',
      })
      .eq('id', payoutRequest.id);

    // Registrar refund no ledger
    try {
      await recordWithdrawalRefund(
        walletType,
        userId,
        amountCents,
        refundedBalance,
        payoutRequest.id,
        'Falha na comunicação com PSP'
      );
    } catch (ledgerError) {
      logger.error('[PixDisbursement] Failed to record refund in ledger', { error: ledgerError });
    }

    // Notificar usuário da falha
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'withdrawal',
      title: 'Falha no saque',
      message: `Seu saque de R$ ${(amountCents / 100).toFixed(2)} falhou. O valor foi devolvido ao seu saldo.`,
    });

    return {
      success: false,
      payoutRequestId: payoutRequest.id,
      status: 'failed',
      message: 'Falha ao processar saque. Valor devolvido ao saldo.',
    };
  }
}

/**
 * Processa confirmação de sucesso do webhook Velana
 */
export async function handlePixDisbursementSuccess(
  correlationId: string,
  webhookPayload?: Record<string, unknown>
): Promise<void> {
  logger.info('[PixDisbursement] Processing success webhook', { correlationId });

  // Buscar payout_request pelo correlationId (armazenado em psp_transaction_id ou idempotency_key)
  const { data: payout, error } = await supabaseAdmin
    .from('payout_requests')
    .select('*')
    .or(`psp_transaction_id.eq.${correlationId},idempotency_key.eq.${correlationId}`)
    .maybeSingle();

  if (error || !payout) {
    logger.warn('[PixDisbursement] Payout request not found for correlationId', { correlationId });
    return;
  }

  if (payout.status === 'paid') {
    logger.info('[PixDisbursement] Payout already marked as paid', { payoutId: payout.id });
    return;
  }

  const walletType = payout.source_type === 'creator' ? 'creator' : 'affiliate';

  // Atualizar status para paid
  await supabaseAdmin
    .from('payout_requests')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      psp_response: webhookPayload || payout.psp_response,
    })
    .eq('id', payout.id);

  // Zerar pending_cents do creator
  if (payout.source_type === 'creator') {
    const { data: wallet } = await supabaseAdmin
      .from('creator_wallet')
      .select('pending_cents')
      .eq('creator_id', payout.creator_id)
      .single();

    const newPending = Math.max(0, (wallet?.pending_cents || 0) - payout.amount);

    await supabaseAdmin
      .from('creator_wallet')
      .update({
        pending_cents: newPending,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', payout.creator_id);
  }

  // Registrar release no ledger
  try {
    await recordWithdrawalRelease(
      walletType,
      payout.creator_id,
      payout.amount,
      0,
      payout.id
    );
  } catch (ledgerError) {
    logger.error('[PixDisbursement] Failed to record release in ledger', { error: ledgerError });
  }

  // Notificar usuário
  await supabaseAdmin.from('notifications').insert({
    user_id: payout.creator_id,
    type: 'withdrawal',
    title: 'Saque concluído!',
    message: `Seu saque de R$ ${(payout.amount / 100).toFixed(2)} foi depositado via PIX.`,
  });

  logger.info('[PixDisbursement] Payout marked as PAID', { payoutId: payout.id, correlationId });
}

/**
 * Processa falha do webhook Velana
 */
export async function handlePixDisbursementFailure(
  correlationId: string,
  failureReason?: string,
  webhookPayload?: Record<string, unknown>
): Promise<void> {
  logger.info('[PixDisbursement] Processing failure webhook', { correlationId, failureReason });

  const { data: payout, error } = await supabaseAdmin
    .from('payout_requests')
    .select('*')
    .or(`psp_transaction_id.eq.${correlationId},idempotency_key.eq.${correlationId}`)
    .maybeSingle();

  if (error || !payout) {
    logger.warn('[PixDisbursement] Payout request not found for correlationId', { correlationId });
    return;
  }

  if (payout.status === 'failed' || payout.status === 'paid') {
    logger.info('[PixDisbursement] Payout already in final state', { payoutId: payout.id, status: payout.status });
    return;
  }

  const walletType = payout.source_type === 'creator' ? 'creator' : 'affiliate';

  // Devolver saldo ao usuário
  let refundedBalance: number;
  if (payout.source_type === 'creator') {
    const { data: wallet } = await supabaseAdmin
      .from('creator_wallet')
      .select('balance_cents, pending_cents')
      .eq('creator_id', payout.creator_id)
      .single();

    refundedBalance = (wallet?.balance_cents || 0) + payout.amount;
    const newPending = Math.max(0, (wallet?.pending_cents || 0) - payout.amount);

    await supabaseAdmin
      .from('creator_wallet')
      .update({
        balance_cents: refundedBalance,
        pending_cents: newPending,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', payout.creator_id);
  } else {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('affiliate_earnings')
      .eq('id', payout.creator_id)
      .single();

    refundedBalance = (profile?.affiliate_earnings || 0) + payout.amount;

    await supabaseAdmin
      .from('profiles')
      .update({
        affiliate_earnings: refundedBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout.creator_id);
  }

  // Atualizar payout_request como falha
  await supabaseAdmin
    .from('payout_requests')
    .update({
      status: 'failed',
      failure_reason: failureReason || 'Pagamento rejeitado pelo banco',
      psp_response: webhookPayload || payout.psp_response,
    })
    .eq('id', payout.id);

  // Registrar refund no ledger
  try {
    await recordWithdrawalRefund(
      walletType,
      payout.creator_id,
      payout.amount,
      refundedBalance,
      payout.id,
      failureReason || 'Falha no processamento PIX'
    );
  } catch (ledgerError) {
    logger.error('[PixDisbursement] Failed to record refund in ledger', { error: ledgerError });
  }

  // Notificar usuário
  await supabaseAdmin.from('notifications').insert({
    user_id: payout.creator_id,
    type: 'withdrawal',
    title: 'Saque falhou',
    message: `Seu saque de R$ ${(payout.amount / 100).toFixed(2)} não pôde ser processado. O valor foi devolvido ao seu saldo. Motivo: ${failureReason || 'Rejeitado pelo banco'}`,
  });

  logger.info('[PixDisbursement] Payout marked as FAILED, balance refunded', { payoutId: payout.id });
}

// Alias para manter compatibilidade com código existente
export const sendPixPaymentViaWoovi = sendPixPaymentViaVelana;
