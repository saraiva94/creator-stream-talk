import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';
import { respondSuccess } from '../lib/responses';
import { supabase } from '../lib/supabaseClient';
import {
  applyRegistrationContextToProfile,
  recordPendingRegistrationReferral,
  RegistrationReferralContext,
  resolveReferralContext,
  REGISTRATION_PRICE_VALUE,
} from '../services/affiliateService';
import { createCheckoutPreference } from '../services/mercadoPagoService';
import { parseWithZod } from '../validation/utils';
import { registrationCheckoutSchema } from '../validation/affiliateSchemas';

type RegistrationProfileResult = {
  profileId: string;
  email: string;
  created: boolean;
};

const ensureProfileForRegistration = async (
  authProfileId: string | undefined,
  email?: string,
  password?: string,
): Promise<RegistrationProfileResult> => {
  if (authProfileId) {
    return { profileId: authProfileId, email: email ?? '', created: false };
  }

  if (!email || !password) {
    const error = new Error('Email and password are required for registration checkout');
    (error as { status?: number }).status = 400;
    throw error;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create user for registration: ${error.message}`);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('User could not be created for registration');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, email })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to upsert profile for registration: ${profileError.message}`);
  }

  return { profileId: userId, email, created: true };
};

const maybeCreateSession = async (email?: string, password?: string) => {
  if (!email || !password) return null;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logger.warn({ event: 'registration.signin.failed', error: error.message });
    return null;
  }
  return data.session;
};

export const registrationCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, referralCode, referrer_id, free, root } = parseWithZod(
      registrationCheckoutSchema,
      req.body ?? {},
    );

    const authProfileId = req.auth?.profileId;
    const profile = await ensureProfileForRegistration(authProfileId, email, password);

    const baseContext = await resolveReferralContext(referralCode ?? null, referrer_id ?? null, email ?? undefined);
    const effectiveContext: RegistrationReferralContext = {
      ...baseContext,
      isRootCreator: Boolean(root) || (!baseContext.directId ? true : baseContext.isRootCreator),
      inviteId: baseContext.inviteId ?? referralCode ?? referrer_id ?? null,
    };

    await applyRegistrationContextToProfile(profile.profileId, effectiveContext);

    if (free) {
      const session = await maybeCreateSession(email, password);
      logger.info({
        event: 'registration.free_link.used',
        profileId: profile.profileId,
        isRootCreator: effectiveContext.isRootCreator,
      });
      return respondSuccess(res, 200, {
        status: 'ok',
        profileId: profile.profileId,
        token: session?.access_token ?? null,
        refresh_token: session?.refresh_token ?? null,
      });
    }

    const paymentId = crypto.randomUUID();
    await recordPendingRegistrationReferral(paymentId, profile.profileId, effectiveContext, { isFree: false });

    const preference = await createCheckoutPreference({
      purchaseType: 'registration',
      userId: profile.profileId,
      price: REGISTRATION_PRICE_VALUE,
      paymentId,
      referrerId: effectiveContext.directId,
      referrerParentId: effectiveContext.rootId,
      isRootCreator: effectiveContext.isRootCreator,
      newUserEmail: profile.email,
      inviteId: effectiveContext.inviteId ?? referralCode ?? null,
    });

    logger.info({
      event: 'registration.checkout.created',
      profileId: profile.profileId,
      paymentId,
      directReferrer: effectiveContext.directId,
      parentReferrer: effectiveContext.rootId,
      isRootCreator: effectiveContext.isRootCreator,
    });

    return respondSuccess(res, 201, {
      ...preference,
      paymentId,
    });
  } catch (error) {
    next(error);
  }
};
