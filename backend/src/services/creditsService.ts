import logger from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

const toInt = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const getBalance = async (userId: string) => {
  const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: userId });

  if (error) {
    throw new Error(`Failed to load credit balance: ${error.message}`);
  }

  const balance = toInt(data);
  return balance < 0 ? 0 : balance;
};

export const addCredits = async (userId: string, amount: number) => {
  const credits = Math.max(0, Math.trunc(amount));
  if (credits <= 0) {
    return getBalance(userId);
  }

  const { data, error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: credits,
  });

  if (error) {
    throw new Error(`Failed to add credits: ${error.message}`);
  }

  const balance = toInt(data);
  logger.info({ event: 'credits.added', userId, creditsAdded: credits, balance });
  return balance;
};

export const consumeCredits = async (userId: string, amount: number) => {
  const credits = Math.max(0, Math.trunc(amount));
  if (credits <= 0) {
    return getBalance(userId);
  }

  const { data, error } = await supabase.rpc('consume_credits', {
    p_user_id: userId,
    p_amount: credits,
  });

  if (error) {
    throw new Error(`Failed to consume credits: ${error.message}`);
  }

  const balance = toInt(data);
  logger.info({ event: 'credits.consumed', userId, creditsConsumed: credits, balance });
  return balance < 0 ? 0 : balance;
};

export const hasEnoughCredits = async (userId: string, required: number) => {
  const balance = await getBalance(userId);
  return balance >= required;
};
