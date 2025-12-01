import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../lib/logger';
import { respondSuccess } from '../lib/responses';
import {
  applyRegistrationContextToProfile,
  recordPendingRegistrationReferral,
  resolveReferralContext,
  REGISTRATION_PRICE_VALUE,
} from '../services/affiliateService';
import { createCheckoutPreference } from '../services/mercadoPagoService';
import { parseWithZod } from '../validation/utils';
import { affiliateRegisterSchema } from '../validation/affiliateSchemas';
import { supabase } from '../lib/supabaseClient';

export const registerAffiliate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      const error = new Error('Authentication required');
      (error as { status?: number }).status = 401;
      throw error;
    }

    const { referralCode } = parseWithZod(affiliateRegisterSchema, req.body ?? {});

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', profileId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load profile: ${profileError.message}`);
    }

    const context = await resolveReferralContext(referralCode, null, profileRow?.email ?? undefined);
    await applyRegistrationContextToProfile(profileId, context);

    const paymentId = crypto.randomUUID();
    await recordPendingRegistrationReferral(paymentId, profileId, context);
    const preference = await createCheckoutPreference({
      purchaseType: 'registration',
      userId: profileId,
      price: REGISTRATION_PRICE_VALUE,
      paymentId,
      referrerId: context.directId,
      referrerParentId: context.rootId,
      isRootCreator: context.isRootCreator,
      newUserEmail: profileRow?.email ?? null,
      inviteId: context.inviteId ?? referralCode ?? null,
    });

    logger.info({
      event: 'affiliate.registration.start',
      profileId,
      referralCode: referralCode ?? null,
      root: context.rootId,
      direct: context.directId,
      paymentId,
    });

    return respondSuccess(res, 201, {
      ...preference,
      paymentId,
      referral: context,
      amount: REGISTRATION_PRICE_VALUE,
    });
  } catch (error) {
    next(error);
  }
};
