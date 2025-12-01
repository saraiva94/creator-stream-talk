import { NextFunction, Request, Response } from 'express';
import { respondError, respondSuccess } from '../lib/responses';
import { getCreditsBalance } from '../services/creditsWalletService';

export const getCreditsBalanceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;

    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const balance = await getCreditsBalance(profileId);
    const balanceCredits = balance.balance_credits ?? 0;
    const estimatedTime = Math.max(0, Math.floor(balanceCredits / 6));

    return respondSuccess(res, 200, {
      balance: balanceCredits,
      balance_credits: balanceCredits,
      estimated_time: estimatedTime,
    });
  } catch (error) {
    next(error);
  }
};
