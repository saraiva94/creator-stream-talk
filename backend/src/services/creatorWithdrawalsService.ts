import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../../supabaseTypes';

type CreatorWalletRow = Tables<'creator_wallet'>;
type PayoutRequestRow = Tables<'payout_requests'>;

const FEE_CENTS = 290;

const ensureWallet = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('creator_wallet')
    .select('creator_id, balance_cents, pending_cents, updated_at')
    .eq('creator_id', creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load creator wallet: ${error.message}`);
  }

  if (data) return data as CreatorWalletRow;

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('creator_wallet')
    .insert({ creator_id: creatorId, balance_cents: 0, pending_cents: 0, updated_at: now })
    .select('creator_id, balance_cents, pending_cents, updated_at')
    .maybeSingle();

  if (insertError || !inserted) {
    throw new Error(`Failed to initialize creator wallet: ${insertError?.message ?? 'unknown error'}`);
  }

  return inserted as CreatorWalletRow;
};

export const getCreatorWalletSummary = async (creatorId: string) => {
  const wallet = await ensureWallet(creatorId);
  return {
    creatorId,
    balanceCents: wallet.balance_cents ?? 0,
    pendingCents: wallet.pending_cents ?? 0,
  };
};

type CreateWithdrawalRequestParams = {
  creatorId: string;
  amountCents: number;
};

export const createWithdrawalRequest = async ({
  creatorId,
  amountCents,
}: CreateWithdrawalRequestParams) => {
  const wallet = await ensureWallet(creatorId);

  if (!Number.isFinite(amountCents)) {
    throw new Error('amount_cents must be a number');
  }

  if (amountCents <= 0) {
    throw new Error('amount_cents must be greater than zero');
  }

  if (amountCents <= FEE_CENTS) {
    throw new Error('amount_cents must be greater than fee_cents');
  }

  const feeCents = FEE_CENTS;
  const netCents = amountCents - feeCents;

  if ((wallet.balance_cents ?? 0) < amountCents) {
    throw new Error('Insufficient balance');
  }

  const balanceAfter = (wallet.balance_cents ?? 0) - amountCents;
  const pendingAfter = (wallet.pending_cents ?? 0) + amountCents;
  const now = new Date().toISOString();

  const { data: walletUpdate, error: walletError } = await supabase
    .from('creator_wallet')
    .update({
      balance_cents: balanceAfter,
      pending_cents: pendingAfter,
      updated_at: now,
    })
    .eq('creator_id', creatorId)
    .eq('balance_cents', wallet.balance_cents ?? 0)
    .select('creator_id')
    .maybeSingle();

  if (walletError) {
    throw new Error(`Failed to update wallet balances: ${walletError.message}`);
  }

  if (!walletUpdate) {
    throw new Error('Failed to update wallet balances: concurrent modification detected');
  }

  const { data: payout, error: payoutError } = await supabase
    .from('payout_requests')
    .insert({
      creator_id: creatorId,
      amount: amountCents, // stored in cents to match internal representation
      status: 'pending',
      created_at: now,
    } satisfies Partial<PayoutRequestRow>)
    .select('id')
    .maybeSingle();

  if (payoutError || !payout) {
    throw new Error(`Failed to create payout request: ${payoutError?.message ?? 'unknown error'}`);
  }

  return {
    requestId: payout.id as string,
    creatorId,
    amountCents,
    feeCents,
    netCents,
    balanceCentsAfter: balanceAfter,
    pendingCentsAfter: pendingAfter,
  };
};
