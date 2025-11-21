import { Request, Response, NextFunction } from 'express';
import { respondSuccess } from '../lib/responses';
import { markRootCreatorProfile } from '../services/affiliateService';
import { parseWithZod } from '../validation/utils';
import { markRootCreatorSchema } from '../validation/affiliateSchemas';
import logger from '../lib/logger';
import { getPublicBaseUrl } from '../lib/env';

export const markRootCreator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id } = parseWithZod(markRootCreatorSchema, req.body ?? {});
    const result = await markRootCreatorProfile(user_id);
    logger.info({ event: 'affiliate.root.marked', userId: user_id });
    return respondSuccess(res, 200, { profile: result });
  } catch (error) {
    next(error);
  }
};

export const generateFreeRegistrationLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const base = getPublicBaseUrl();
    const normalized = base.replace(/\/$/, '');
    const url = `${normalized}/register?free=1&root=1`;
    logger.info({ event: 'affiliate.registration.free_link.generated', url });
    return respondSuccess(res, 200, { url });
  } catch (error) {
    next(error);
  }
};
