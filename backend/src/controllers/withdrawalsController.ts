import { Request, Response, NextFunction } from 'express';
import { respondError, respondSuccess } from '../lib/responses';
import {
  createWithdrawalRequest,
  getCreatorWalletSummary,
  listCreatorPayoutRequests,
} from '../services/creatorWithdrawalsService';

export const getWalletSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.auth?.profileId;
    if (!creatorId) {
      return respondError(res, 401, 'Authentication required');
    }

    const summary = await getCreatorWalletSummary(creatorId);
    return respondSuccess(res, 200, {
      balance_cents: summary.balanceCents,
      pending_cents: summary.pendingCents,
    });
  } catch (error) {
    next(error);
  }
};

export const createWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.auth?.profileId;
    if (!creatorId) {
      return respondError(res, 401, 'Authentication required');
    }

    const amountCentsRaw = req.body?.amount_cents;
    const pixKeyRaw = req.body?.pix_key;
    const amountCents = Number(amountCentsRaw);

    const result = await createWithdrawalRequest({ creatorId, amountCents, pixKey: pixKeyRaw });

    console.log(
      JSON.stringify({
        event: 'withdrawal.request.created',
        creatorId,
        requestId: result.requestId,
        amountCents: result.amountCents,
        pixKey: result.pixKey,
      }),
    );

    return respondSuccess(res, 201, {
      requestId: result.requestId,
      amount_cents: result.amountCents,
      balance_cents_after: result.balanceCentsAfter,
      pending_cents_after: result.pendingCentsAfter,
    });
  } catch (error) {
    const message = (error as Error).message || 'Unable to create withdrawal request';
    if (
      message.toLowerCase().includes('insufficient') ||
      message.toLowerCase().includes('amount') ||
      message.toLowerCase().includes('pix')
    ) {
      return respondError(res, 400, message);
    }
    return next(error);
  }
};

export const getPayoutHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.auth?.profileId;
    if (!creatorId) {
      return respondError(res, 401, 'Authentication required');
    }

    const payouts = await listCreatorPayoutRequests(creatorId);
    return respondSuccess(res, 200, { payouts });
  } catch (error) {
    next(error);
  }
};
