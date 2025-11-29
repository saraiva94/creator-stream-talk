import { Request, Response, NextFunction } from 'express';
import { respondError, respondSuccess } from '../lib/responses';
import {
  listPendingPayoutRequests,
  approvePayoutRequest,
  rejectPayoutRequest,
} from '../services/adminPayoutsService';

export const listPending = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await listPendingPayoutRequests();
    return respondSuccess(res, 200, { pending });
  } catch (error) {
    next(error);
  }
};

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.id;
    if (!requestId) {
      return respondError(res, 400, 'Missing payout request id');
    }

    const adminId = req.auth?.profileId ?? 'admin';
    const result = await approvePayoutRequest({ requestId, adminId });

    return respondSuccess(res, 200, result);
  } catch (error) {
    const message = (error as Error).message.toLowerCase();
    if (message.includes('not found')) {
      return respondError(res, 404, (error as Error).message);
    }
    if (message.includes('not pending')) {
      return respondError(res, 400, (error as Error).message);
    }
    next(error);
  }
};

export const reject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.id;
    if (!requestId) {
      return respondError(res, 400, 'Missing payout request id');
    }

    const adminId = req.auth?.profileId ?? 'admin';
    const reason = req.body?.reason as string | undefined;
    const result = await rejectPayoutRequest({ requestId, adminId, reason });

    return respondSuccess(res, 200, result);
  } catch (error) {
    const message = (error as Error).message.toLowerCase();
    if (message.includes('not found')) {
      return respondError(res, 404, (error as Error).message);
    }
    if (message.includes('not pending')) {
      return respondError(res, 400, (error as Error).message);
    }
    next(error);
  }
};
