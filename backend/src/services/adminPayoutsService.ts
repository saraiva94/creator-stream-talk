import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../types/supabaseTypes';

type PayoutRequestRow = Tables<'payout_requests'>;
type CreatorWalletRow = Tables<'creator_wallet'>;
type CreatorBankAccount = {
  bank_name?: string | null;
  account_type?: string | null;
  account_number?: string | null;
  routing_number?: string | null;
  account_holder_name?: string | null;
  document_number?: string | null;
};

type PendingPayoutRow = {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  created_at: string;
  pix_key?: string | null;
  creator_bank_accounts?: CreatorBankAccount | CreatorBankAccount[] | null;
};

const STATUS_PENDING = 'pending';
const STATUS_APPROVED = 'approved';
const STATUS_PAID = 'paid';
const STATUS_CANCELLED = 'cancelled';

const ensureWallet = async (creatorId: string): Promise<CreatorWalletRow> => {
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

const fetchPayoutById = async (id: string): Promise<PayoutRequestRow> => {
  const { data, error } = await supabase.from('payout_requests').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load payout request: ${error.message}`);
  }

  if (!data) {
    const notFound = new Error('Payout request not found');
    (notFound as { status?: number }).status = 404;
    throw notFound;
  }

  return data as PayoutRequestRow;
};

export const listPendingPayoutRequests = async () => {
  const { data, error } = await supabase
    .from('payout_requests')
    .select(
      `id, creator_id, amount, status, created_at, bank_account_id,
       creator_bank_accounts!left ( bank_name, account_type, account_number, routing_number, account_holder_name, document_number ),
       pix_key`,
    )
    .eq('status', STATUS_PENDING)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list pending payout requests: ${error.message}`);
  }

  return (data ?? []).map((row: PendingPayoutRow) => {
    const bank = Array.isArray(row.creator_bank_accounts)
      ? row.creator_bank_accounts[0] ?? null
      : row.creator_bank_accounts ?? null;

    return {
      id: row.id,
      creatorId: row.creator_id,
      amountCents: row.amount,
      status: row.status,
      createdAt: row.created_at,
      pixKey: row.pix_key ?? null,
      bank,
    };
  });
};

export const approvePayoutRequest = async ({ requestId, adminId }: { requestId: string; adminId: string }) => {
  const payout = await fetchPayoutById(requestId);

  if (payout.status !== STATUS_PENDING) {
    const err = new Error('Payout request is not pending');
    (err as { status?: number }).status = 400;
    throw err;
  }

  const creatorId = payout.creator_id;
  const amountCents = payout.amount as number;

  const wallet = await ensureWallet(creatorId);
  const pendingAfter = (wallet.pending_cents ?? 0) - amountCents;
  if (pendingAfter < 0) {
    throw new Error('Pending balance would become negative');
  }

  const now = new Date().toISOString();

  const { data: walletUpdate, error: walletError } = await supabase
    .from('creator_wallet')
    .update({ pending_cents: pendingAfter, updated_at: now })
    .eq('creator_id', creatorId)
    .eq('pending_cents', wallet.pending_cents ?? 0)
    .select('creator_id')
    .maybeSingle();

  if (walletError) {
    throw new Error(`Failed to update wallet pending balance: ${walletError.message}`);
  }

  if (!walletUpdate) {
    throw new Error('Failed to update wallet pending balance: concurrent modification detected');
  }

  const { data: payoutUpdate, error: payoutError } = await supabase
    .from('payout_requests')
    .update({
      status: STATUS_APPROVED,
      approved_by: adminId,
      approved_at: now,
    })
    .eq('id', requestId)
    .eq('status', STATUS_PENDING)
    .select('id, status')
    .maybeSingle();

  if (payoutError) {
    throw new Error(`Failed to approve payout request: ${payoutError.message}`);
  }

  if (!payoutUpdate) {
    throw new Error('Failed to approve payout request: concurrent modification detected');
  }

  console.log(
    JSON.stringify({
      event: 'payout.approved',
      requestId,
      creatorId,
      amountCents,
      status: payoutUpdate.status,
    }),
  );

  return {
    requestId,
    creatorId,
    amountCents,
    status: payoutUpdate.status,
    pendingCentsAfter: pendingAfter,
  };
};

export const rejectPayoutRequest = async ({
  requestId,
  adminId,
  reason,
}: {
  requestId: string;
  adminId: string;
  reason?: string;
}) => {
  const payout = await fetchPayoutById(requestId);

  if (payout.status !== STATUS_PENDING) {
    const err = new Error('Payout request is not pending');
    (err as { status?: number }).status = 400;
    throw err;
  }

  const creatorId = payout.creator_id;
  const amountCents = payout.amount as number;

  const wallet = await ensureWallet(creatorId);
  const pendingAfter = (wallet.pending_cents ?? 0) - amountCents;
  const balanceAfter = (wallet.balance_cents ?? 0) + amountCents;

  if (pendingAfter < 0) {
    throw new Error('Pending balance would become negative');
  }

  const now = new Date().toISOString();

  const { data: walletUpdate, error: walletError } = await supabase
    .from('creator_wallet')
    .update({ pending_cents: pendingAfter, balance_cents: balanceAfter, updated_at: now })
    .eq('creator_id', creatorId)
    .eq('pending_cents', wallet.pending_cents ?? 0)
    .select('creator_id')
    .maybeSingle();

  if (walletError) {
    throw new Error(`Failed to update wallet balances: ${walletError.message}`);
  }

  if (!walletUpdate) {
    throw new Error('Failed to update wallet balances: concurrent modification detected');
  }

  const { data: payoutUpdate, error: payoutError } = await supabase
    .from('payout_requests')
    .update({
      status: STATUS_CANCELLED,
      approved_by: adminId,
      admin_notes: reason ?? null,
    })
    .eq('id', requestId)
    .eq('status', STATUS_PENDING)
    .select('id, status')
    .maybeSingle();

  if (payoutError) {
    throw new Error(`Failed to reject payout request: ${payoutError.message}`);
  }

  if (!payoutUpdate) {
    throw new Error('Failed to reject payout request: concurrent modification detected');
  }

  console.log(
    JSON.stringify({
      event: 'payout.rejected',
      requestId,
      creatorId,
      amountCents,
      status: payoutUpdate.status,
    }),
  );

  return {
    requestId,
    creatorId,
    amountCents,
    status: payoutUpdate.status,
    balanceCentsAfter: balanceAfter,
    pendingCentsAfter: pendingAfter,
  };
};
