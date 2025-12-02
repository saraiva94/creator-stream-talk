import logger from '../lib/logger';
import { adjustWalletBalance, getCreditsBalance, getOrCreateCreditsWallet } from './creditsWalletService';

const normalizeAmount = (amount: number) => Math.max(0, Math.trunc(amount));

export const getBalance = async (userId: string) => {
  const wallet = await getCreditsBalance(userId);
  return Math.max(0, wallet.balance_credits ?? 0);
};

export const addCredits = async (userId: string, amount: number) => {
  const credits = normalizeAmount(amount);
  if (credits <= 0) {
    return getBalance(userId);
  }

  const next = await adjustWalletBalance(userId, credits);
  logger.info({ event: 'credits.added', userId, creditsAdded: credits, balance: next });
  return next;
};

export const consumeCredits = async (userId: string, amount: number) => {
  const credits = normalizeAmount(amount);
  if (credits <= 0) {
    return getBalance(userId);
  }

  const wallet = await getOrCreateCreditsWallet(userId);
  const current = wallet.balance_credits ?? 0;
  const allowed = Math.min(current, credits);
  if (allowed <= 0) {
    return 0;
  }

  const next = await adjustWalletBalance(userId, -allowed);
  logger.info({ event: 'credits.consumed', userId, creditsConsumed: allowed, balance: next });
  return next;
};

export const hasEnoughCredits = async (userId: string, required: number) => {
  const balance = await getBalance(userId);
  return balance >= required;
};
