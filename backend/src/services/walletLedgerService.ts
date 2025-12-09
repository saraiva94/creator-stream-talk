/**
 * Serviço de Ledger de Wallet
 * 
 * Registra todas as movimentações de saldo nas wallets do sistema.
 * Garante rastreabilidade e auditoria de todas as operações financeiras.
 */

import { supabaseAdmin } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

export type WalletType = 'creator' | 'affiliate' | 'credits';
export type TransactionType = 'credit' | 'debit' | 'hold' | 'release' | 'refund';

export interface WalletTransactionParams {
  walletType: WalletType;
  walletId: string;
  type: TransactionType;
  amountCents: number;
  balanceAfterCents: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WalletTransaction {
  id: string;
  wallet_type: WalletType;
  wallet_id: string;
  type: TransactionType;
  amount_cents: number;
  balance_after_cents: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Registra uma transação no ledger de wallet
 */
export async function recordWalletTransaction(
  params: WalletTransactionParams
): Promise<WalletTransaction> {
  const {
    walletType,
    walletId,
    type,
    amountCents,
    balanceAfterCents,
    referenceType,
    referenceId,
    description,
    metadata = {},
  } = params;

  logger.info('[WalletLedger] Recording transaction', {
    walletType,
    walletId,
    type,
    amountCents,
    balanceAfterCents,
    referenceType,
    referenceId,
  });

  const { data, error } = await supabaseAdmin
    .from('wallet_transactions')
    .insert({
      wallet_type: walletType,
      wallet_id: walletId,
      type,
      amount_cents: amountCents,
      balance_after_cents: balanceAfterCents,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      description: description || null,
      metadata,
    })
    .select()
    .single();

  if (error) {
    logger.error('[WalletLedger] Failed to record transaction', { error, params });
    throw new Error(`Falha ao registrar transação no ledger: ${error.message}`);
  }

  logger.info('[WalletLedger] Transaction recorded', { transactionId: data.id });
  return data as WalletTransaction;
}

/**
 * Busca histórico de transações de uma wallet
 */
export async function getWalletTransactions(
  walletType: WalletType,
  walletId: string,
  limit = 50
): Promise<WalletTransaction[]> {
  const { data, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_type', walletType)
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[WalletLedger] Failed to fetch transactions', { error, walletType, walletId });
    throw new Error(`Falha ao buscar transações: ${error.message}`);
  }

  return (data || []) as WalletTransaction[];
}

/**
 * Busca transação por referência
 */
export async function getTransactionByReference(
  referenceType: string,
  referenceId: string
): Promise<WalletTransaction | null> {
  const { data, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .maybeSingle();

  if (error) {
    logger.error('[WalletLedger] Failed to fetch transaction by reference', { error, referenceType, referenceId });
    throw new Error(`Falha ao buscar transação: ${error.message}`);
  }

  return data as WalletTransaction | null;
}

/**
 * Registra débito (hold) para saque
 */
export async function recordWithdrawalHold(
  walletType: WalletType,
  walletId: string,
  amountCents: number,
  balanceAfterCents: number,
  payoutRequestId: string
): Promise<WalletTransaction> {
  return recordWalletTransaction({
    walletType,
    walletId,
    type: 'hold',
    amountCents,
    balanceAfterCents,
    referenceType: 'payout_request',
    referenceId: payoutRequestId,
    description: `Saque PIX em processamento - R$ ${(amountCents / 100).toFixed(2)}`,
    metadata: { action: 'withdrawal.hold' },
  });
}

/**
 * Registra liberação após saque confirmado
 */
export async function recordWithdrawalRelease(
  walletType: WalletType,
  walletId: string,
  amountCents: number,
  balanceAfterCents: number,
  payoutRequestId: string
): Promise<WalletTransaction> {
  return recordWalletTransaction({
    walletType,
    walletId,
    type: 'release',
    amountCents,
    balanceAfterCents,
    referenceType: 'payout_request',
    referenceId: payoutRequestId,
    description: `Saque PIX confirmado - R$ ${(amountCents / 100).toFixed(2)}`,
    metadata: { action: 'withdrawal.release' },
  });
}

/**
 * Registra estorno após falha no saque
 */
export async function recordWithdrawalRefund(
  walletType: WalletType,
  walletId: string,
  amountCents: number,
  balanceAfterCents: number,
  payoutRequestId: string,
  reason: string
): Promise<WalletTransaction> {
  return recordWalletTransaction({
    walletType,
    walletId,
    type: 'refund',
    amountCents,
    balanceAfterCents,
    referenceType: 'payout_request',
    referenceId: payoutRequestId,
    description: `Saque PIX estornado - R$ ${(amountCents / 100).toFixed(2)} - Motivo: ${reason}`,
    metadata: { action: 'withdrawal.refund', reason },
  });
}
