import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { respondError, respondSuccess } from '../lib/responses';
import { addCredits, consumeCredits, getBalance } from '../services/creditsService';
import { createCheckoutPreference } from '../services/mercadoPagoService';

const CREDIT_PACK_PRICE = 5;
const CREDIT_PACK_AMOUNT = 1800;

export const getBalanceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return respondError(res, 401, 'Authentication required');

    const balance = await getBalance(userId);
    return respondSuccess(res, 200, { creditBalance: balance });
  } catch (error) {
    next(error);
  }
};

export const purchaseCreditsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return respondError(res, 401, 'Authentication required');

    const paymentId = crypto.randomUUID();
    const preference = await createCheckoutPreference({
      type: 'credits',
      userId,
      price: CREDIT_PACK_PRICE,
      paymentId,
      credits: CREDIT_PACK_AMOUNT,
    });

    logger.info({ event: 'credits.purchase.initiated', userId, paymentId, credits: CREDIT_PACK_AMOUNT });
    return respondSuccess(res, 201, {
      ...preference,
      credits: CREDIT_PACK_AMOUNT,
      amount: CREDIT_PACK_PRICE,
      paymentId,
    });
  } catch (error) {
    next(error);
  }
};

export const consumeCreditsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return respondError(res, 401, 'Authentication required');

    const amount = Number((req.body?.amount as number | string | undefined) ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return respondError(res, 400, 'amount must be a positive number');
    }

    const balance = await consumeCredits(userId, amount);
    return respondSuccess(res, 200, { creditBalance: balance });
  } catch (error) {
    next(error);
  }
};
