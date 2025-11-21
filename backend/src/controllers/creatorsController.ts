import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { respondSuccess } from '../lib/responses';
import {
  registerCreatorProfile,
  ensureCreatorOwnedByProfile,
  getCreatorBalance,
  getCreatorCommissions,
  getCreatorReferralData,
  createOrGetReferralCode,
  submitWithdrawal,
  getWithdrawalHistory,
} from '../services/supabaseService';
import { getAffiliateStatsForProfile } from '../services/affiliateService';
import { parseWithZod } from '../validation/utils';
import { registerCreatorSchema } from '../validation/creatorsSchemas';
import { submitWithdrawalSchema } from '../validation/withdrawalsSchemas';

const ensureAuthContext = (req: Request) => {
  const profileId = req.auth?.profileId;
  if (!profileId) {
    const error = new Error('Authentication required');
    (error as { status?: number }).status = 401;
    throw error;
  }
  return profileId;
};

const ensureCreatorContext = (req: Request) => {
  const profileId = ensureAuthContext(req);
  const creatorId = req.auth?.creatorId ?? undefined;
  if (!creatorId) {
    const error = new Error('Creator account required');
    (error as { status?: number }).status = 403;
    throw error;
  }
  return { creatorId, profileId };
};

export const registerCreator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = ensureAuthContext(req);
    const { bio, pricePerMinute, referralCode } = parseWithZod(registerCreatorSchema, req.body ?? {});

    const creator = await registerCreatorProfile({
      profileId,
      bio,
      pricePerMinute,
      referralCode,
    });

    logger.info({ event: 'creators.register', profileId, creatorId: creator.id });
    return respondSuccess(res, 201, { creator });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('Referral code')) {
      (error as { status?: number }).status = (error as { status?: number }).status ?? 400;
    } else if (message.includes('Creator already registered')) {
      (error as { status?: number }).status = (error as { status?: number }).status ?? 409;
    }
    return next(error);
  }
};

export const getCreatorBalanceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);

    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const balance = await getCreatorBalance(creatorId);
    return respondSuccess(res, 200, balance);
  } catch (error) {
    next(error);
  }
};

export const getCreatorCommissionsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);

    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const commissions = await getCreatorCommissions(creatorId);
    return respondSuccess(res, 200, { commissions });
  } catch (error) {
    next(error);
  }
};

export const getCreatorReferralController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);

    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const payload = await getCreatorReferralData(creatorId);
    return respondSuccess(res, 200, payload);
  } catch (error) {
    next(error);
  }
};

export const createReferralCodeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);

    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const referral = await createOrGetReferralCode(creatorId);
    logger.info({ event: 'referrals.code.generated', creatorId, referralId: referral.id });
    return respondSuccess(res, 201, referral);
  } catch (error) {
    next(error);
  }
};

export const submitWithdrawalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);
    const { amount } = parseWithZod(submitWithdrawalSchema, req.body ?? {});

    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const withdrawal = await submitWithdrawal(creatorId, amount);
    logger.info({ event: 'withdrawals.created', creatorId, withdrawalId: withdrawal.id, amount: withdrawal.amount });
    return respondSuccess(res, 201, { withdrawal });
  } catch (error) {
    next(error);
  }
};

export const getWithdrawalHistoryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);

    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const withdrawals = await getWithdrawalHistory(creatorId);
    return respondSuccess(res, 200, { withdrawals });
  } catch (error) {
    next(error);
  }
};

export const getCreatorAffiliateStatsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { creatorId, profileId } = ensureCreatorContext(req);
    await ensureCreatorOwnedByProfile(creatorId, profileId);
    const stats = await getAffiliateStatsForProfile(profileId);
    return respondSuccess(res, 200, stats);
  } catch (error) {
    next(error);
  }
};
