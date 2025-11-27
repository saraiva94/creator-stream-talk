import logger from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../../supabaseTypes';

type CreditsWalletRow = Tables<'credits_wallet'>;
type CreditPurchaseRow = Tables<'credit_purchases'>;

const walletSelect = 'profile_id, balance_credits, updated_at';

export const getOrCreateCreditsWallet = async (profileId: string): Promise<CreditsWalletRow> => {
  const { data, error } = await supabase
    .from('credits_wallet')
    .select(walletSelect)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load credits wallet: ${error.message}`);
  }

  if (data) {
    return data as CreditsWalletRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('credits_wallet')
    .insert({ profile_id: profileId })
    .select(walletSelect)
    .maybeSingle();

  if (insertError) {
    if (isUniqueConstraintError(insertError)) {
      const { data: existing, error: reloadError } = await supabase
        .from('credits_wallet')
        .select(walletSelect)
        .eq('profile_id', profileId)
        .maybeSingle();

      if (reloadError || !existing) {
        throw new Error(`Failed to create credits wallet after conflict: ${reloadError?.message ?? insertError.message}`);
      }

      return existing as CreditsWalletRow;
    }
    throw new Error(`Failed to create credits wallet: ${insertError.message}`);
  }

  if (!inserted) {
    throw new Error('Failed to create credits wallet: no data returned');
  }

  return inserted as CreditsWalletRow;
};

export const getCreditsBalance = async (profileId: string) => {
  const wallet = await getOrCreateCreditsWallet(profileId);
  return { balance_credits: wallet.balance_credits };
};

export type RegisterCreditPurchaseParams = {
  profileId: string;
  credits: number;
  amountCents: number;
  paymentId: string;
};

const normalizeAmount = (value: number) => {
  const normalized = Math.floor(value);
  return normalized < 0 ? 0 : normalized;
};

const isUniqueConstraintError = (error: { code?: string; message?: string }) => {
  if (!error) return false;
  if (error.code === '23505') return true;
  return (error.message ?? '').toLowerCase().includes('duplicate') || (error.message ?? '').toLowerCase().includes('unique');
};

const updateWalletBalance = async (profileId: string, creditsToAdd: number) => {
  const wallet = await getOrCreateCreditsWallet(profileId);
  const nextBalance = wallet.balance_credits + creditsToAdd;

  const { error: updateError } = await supabase
    .from('credits_wallet')
    .update({ balance_credits: nextBalance, updated_at: new Date().toISOString() })
    .eq('profile_id', profileId);

  if (updateError) {
    throw new Error(`Failed to update credits wallet: ${updateError.message}`);
  }
};

export const registerCreditPurchase = async ({
  profileId,
  credits,
  amountCents,
  paymentId,
}: RegisterCreditPurchaseParams): Promise<void> => {
  const normalizedCredits = normalizeAmount(credits);
  const normalizedAmountCents = normalizeAmount(amountCents);

  if (!paymentId) {
    throw new Error('paymentId is required');
  }

  if (normalizedCredits <= 0) {
    throw new Error('credits must be greater than zero');
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from('credit_purchases')
    .insert({
      profile_id: profileId,
      credits: normalizedCredits,
      amount_cents: normalizedAmountCents,
      status: 'completed',
      payment_id: paymentId,
    } satisfies Partial<CreditPurchaseRow>)
    .select('id')
    .maybeSingle();

  if (purchaseError) {
    if (isUniqueConstraintError(purchaseError)) {
      logger.info({ event: 'credits.purchase.duplicate', paymentId, profileId });
      return;
    }
    throw new Error(`Failed to record credit purchase: ${purchaseError.message}`);
  }

  logger.info({ event: 'credits.purchase.recorded', purchaseId: purchase?.id, paymentId, profileId });

  try {
    await updateWalletBalance(profileId, normalizedCredits);
  } catch (updateError) {
    if (purchase?.id) {
      logger.warn({
        event: 'credits.wallet.update_failed_cleanup',
        purchaseId: purchase.id,
        paymentId,
        profileId,
        error: (updateError as Error).message,
      });
      await supabase.from('credit_purchases').delete().eq('id', purchase.id);
    }
    throw updateError;
  }
};
