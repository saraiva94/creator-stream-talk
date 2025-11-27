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
    return respondSuccess(res, 200, balance);
  } catch (error) {
    next(error);
  }
};
