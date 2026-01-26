import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';
import { respondSuccess } from '../lib/responses';
import { supabase } from '../lib/supabaseClient';
import {
  applyRegistrationContextToProfile,
  applyRegistrationAffiliatePayout,
  recordPendingRegistrationReferral,
  RegistrationReferralContext,
  resolveReferralContext,
  REGISTRATION_PRICE_VALUE,
} from '../services/affiliateService';
import { createPixPayment, REGISTRATION_PRICE_CENTS } from '../services/velanaCashInService';
import { parseWithZod } from '../validation/utils';
import { registrationCheckoutSchema } from '../validation/affiliateSchemas';
import { getEnv } from '../lib/env';

// Helper function to calculate commission cents
const calculateRegistrationCommissionCents = (
  directId: string | null,
  rootId: string | null,
): {
  directAmountCents: number;
  rootAmountCents: number;
  platformAmountCents: number;
} => {
  const directAmountCents = directId ? 100 : 0; // R$1.00
  const effectiveRootId = rootId && rootId !== directId ? rootId : null;
  const rootAmountCents = effectiveRootId ? 50 : 0; // R$0.50
  const platformAmountCents = Math.max(0, 700 - directAmountCents - rootAmountCents);
  return { directAmountCents, rootAmountCents, platformAmountCents };
};


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
    if (!email) {
      const { data: existingProfile, error: loadError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', authProfileId)
        .maybeSingle();

      if (loadError) {
        throw new Error(`Failed to load existing profile for registration: ${loadError.message}`);
      }

      email = existingProfile?.email ?? undefined;
    }

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
    const { email, password, referralCode, referrer_id, free, root, customerName, customerCpf } = parseWithZod(
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

    // Record pending referral BEFORE creating payment preference
    const paymentId = crypto.randomUUID();
    await recordPendingRegistrationReferral(paymentId, profile.profileId, effectiveContext, {
      isFree: Boolean(free),
      email: profile.email,
    });

    if (free) {
      // For free registrations, immediately apply payouts and activate
      const { directAmountCents, rootAmountCents, platformAmountCents } = calculateRegistrationCommissionCents(
        effectiveContext.directId,
        effectiveContext.rootId
      );

      await applyRegistrationAffiliatePayout({
        newUserId: profile.profileId,
        directId: effectiveContext.directId,
        rootId: effectiveContext.rootId,
        directAmountCents,
        rootAmountCents,
        platformAmountCents,
        paymentId,
      });

      // Record platform revenue for free registration (still counts for tracking)
      await supabase.from('platform_revenue').insert({
        source_type: 'registration_free',
        source_id: paymentId,
        amount: platformAmountCents,
        user_id: profile.profileId,
        metadata: { 
          direct_id: effectiveContext.directId, 
          root_id: effectiveContext.rootId, 
          gross_amount: 500,
          is_free: true 
        },
      });

      // Mark registration as completed
      await supabase
        .from('registration_referrals')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('payment_id', paymentId);

      // Activate profile
      await supabase
        .from('profiles')
        .update({ 
          status: 'active', 
          is_subscribed: true,
        })
        .eq('id', profile.profileId);

      const session = await maybeCreateSession(email, password);
      logger.info({
        event: 'registration.free_link.used',
        profileId: profile.profileId,
        isRootCreator: effectiveContext.isRootCreator,
        directId: effectiveContext.directId,
        rootId: effectiveContext.rootId,
        directAmountCents,
        rootAmountCents,
        platformAmountCents,
      });
      return respondSuccess(res, 200, {
        status: 'ok',
        profileId: profile.profileId,
        token: session?.access_token ?? null,
        refresh_token: session?.refresh_token ?? null,
      });
    }

    // Create PIX payment via Velana
    const supabaseUrl = getEnv('SUPABASE_URL');
    const webhookUrl = `${supabaseUrl}/functions/v1/velana-webhook`;

    const velanaResult = await createPixPayment({
      amountCents: REGISTRATION_PRICE_CENTS,
      userId: profile.profileId,
      eventType: 'REGISTRATION',
      customer: {
        name: customerName || email?.split('@')[0] || 'Usuário',
        email: profile.email,
        cpf: customerCpf || '00000000000',
      },
      metadata: {
        userId: profile.profileId,
        eventType: 'REGISTRATION',
        directId: effectiveContext.directId,
        rootId: effectiveContext.rootId,
        isRootCreator: effectiveContext.isRootCreator,
        inviteId: effectiveContext.inviteId,
      },
      description: 'StreamStar - Ativação de Conta',
      webhookUrl,
      externalReference: paymentId,
    });

    if (!velanaResult.success) {
      throw new Error(velanaResult.error || 'Falha ao criar pagamento PIX');
    }

    logger.info({
      event: 'registration.checkout.created',
      profileId: profile.profileId,
      paymentId,
      directReferrer: effectiveContext.directId,
      parentReferrer: effectiveContext.rootId,
      isRootCreator: effectiveContext.isRootCreator,
      transactionId: velanaResult.transactionId,
    });

    return respondSuccess(res, 201, {
      paymentId,
      transactionId: velanaResult.transactionId,
      secureUrl: velanaResult.secureUrl,
      pix: velanaResult.pix,
      amount: REGISTRATION_PRICE_VALUE,
    });
  } catch (error) {
    next(error);
  }
};
