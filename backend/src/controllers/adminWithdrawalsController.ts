import { Request, Response, NextFunction } from 'express';
import { respondSuccess } from '../lib/responses';
import {
  approveWithdrawalRequest,
  getPendingWithdrawalsForAdmin,
  markWithdrawalPaid,
  rejectWithdrawalRequest,
} from '../services/supabaseService';
import { parseWithZod } from '../validation/utils';
import { withdrawalActionSchema } from '../validation/withdrawalsSchemas';

const parseActionPayload = (req: Request) => {
  return parseWithZod(withdrawalActionSchema, {
    withdrawalId: (req.body?.withdrawalId ?? req.query?.withdrawalId) as string | undefined,
    note: req.body?.note,
  });
};

export const listPendingWithdrawals = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await getPendingWithdrawalsForAdmin();
    return respondSuccess(res, 200, { pending });
  } catch (error) {
    next(error);
  }
};

export const approveWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { withdrawalId, note } = parseActionPayload(req);
    const result = await approveWithdrawalRequest(withdrawalId, req.auth!.profileId, note);
    return respondSuccess(res, 200, { withdrawal: result });
  } catch (error) {
    if ((error as Error).message.includes('pending')) {
      (error as { status?: number }).status = (error as { status?: number }).status ?? 400;
    }
    next(error);
  }
};

export const rejectWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { withdrawalId, note } = parseActionPayload(req);
    const result = await rejectWithdrawalRequest(withdrawalId, req.auth!.profileId, note);
    return respondSuccess(res, 200, { withdrawal: result });
  } catch (error) {
    const message = (error as Error).message.toLowerCase();
    if (message.includes('not found')) {
      (error as { status?: number }).status = (error as { status?: number }).status ?? 404;
    } else {
      (error as { status?: number }).status = (error as { status?: number }).status ?? 400;
    }
    next(error);
  }
};

export const markWithdrawalPaidHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { withdrawalId, note } = parseActionPayload(req);
    const result = await markWithdrawalPaid(withdrawalId, req.auth!.profileId, note);
    return respondSuccess(res, 200, { withdrawal: result });
  } catch (error) {
    if ((error as Error).message.includes('approved')) {
      (error as { status?: number }).status = (error as { status?: number }).status ?? 400;
    }
    next(error);
  }
};
