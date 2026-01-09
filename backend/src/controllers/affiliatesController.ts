import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../lib/logger';
import { respondError, respondSuccess } from '../lib/responses';
import {
  applyRegistrationContextToProfile,
  ensureReferralCode,
  recordPendingRegistrationReferral,
  resolveReferralContext,
  REGISTRATION_PRICE_VALUE,
} from '../services/affiliateService';
import { createPixPayment, REGISTRATION_PRICE_CENTS } from '../services/velanaCashInService';
import { parseWithZod } from '../validation/utils';
import { affiliateRegisterSchema, referralCodeSchema } from '../validation/affiliateSchemas';
import { supabase } from '../lib/supabaseClient';
import { getEnv } from '../lib/env';

export const registerAffiliate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      const error = new Error('Authentication required');
      (error as { status?: number }).status = 401;
      throw error;
    }

    const { referralCode, customerName, customerCpf } = parseWithZod(affiliateRegisterSchema, req.body ?? {});

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

    // Create PIX payment via Velana
    const supabaseUrl = getEnv('SUPABASE_URL');
    const webhookUrl = `${supabaseUrl}/functions/v1/velana-webhook`;

    const velanaResult = await createPixPayment({
      amountCents: REGISTRATION_PRICE_CENTS,
      userId: profileId,
      eventType: 'REGISTRATION',
      customer: {
        name: customerName || profileRow?.email?.split('@')[0] || 'Usuário',
        email: profileRow?.email || '',
        cpf: customerCpf || '00000000000',
      },
      metadata: {
        userId: profileId,
        eventType: 'REGISTRATION',
        directId: context.directId,
        rootId: context.rootId,
        isRootCreator: context.isRootCreator,
        inviteId: context.inviteId ?? referralCode ?? null,
      },
      description: 'StreamStar - Ativação de Conta',
      webhookUrl,
      externalReference: paymentId,
    });

    if (!velanaResult.success) {
      throw new Error(velanaResult.error || 'Falha ao criar pagamento PIX');
    }

    logger.info({
      event: 'affiliate.registration.start',
      profileId,
      referralCode: referralCode ?? null,
      root: context.rootId,
      direct: context.directId,
      paymentId,
      transactionId: velanaResult.transactionId,
    });

    return respondSuccess(res, 201, {
      paymentId,
      transactionId: velanaResult.transactionId,
      secureUrl: velanaResult.secureUrl,
      pix: velanaResult.pix,
      referral: context,
      amount: REGISTRATION_PRICE_VALUE,
    });
  } catch (error) {
    next(error);
  }
};

const normalizeReferralCode = (value: string) => value.trim().toLowerCase();

export const getAffiliateCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const code = await ensureReferralCode(profileId);
    return respondSuccess(res, 200, { code });
  } catch (error) {
    next(error);
  }
};

export const updateAffiliateCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const { code } = parseWithZod(referralCodeSchema, req.body ?? {});
    const normalized = normalizeReferralCode(code);

    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', normalized)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check referral code availability: ${existingError.message}`);
    }

    if (existing && existing.id !== profileId) {
      return respondError(res, 409, 'Referral code already in use');
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referral_code: normalized })
      .eq('id', profileId);

    if (updateError) {
      throw new Error(`Failed to update referral code: ${updateError.message}`);
    }

    return respondSuccess(res, 200, { code: normalized });
  } catch (error) {
    next(error);
  }
};

export const validateAffiliateCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawCode = (req.query?.code as string | undefined) ?? (req.body as { code?: string } | null)?.code;

    if (!rawCode) {
      return respondError(res, 400, 'Referral code is required');
    }

    const { code } = parseWithZod(referralCodeSchema, { code: rawCode });
    const normalized = normalizeReferralCode(code);

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', normalized)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate referral code: ${error.message}`);
    }

    const ownerId = data?.id ?? null;
    return respondSuccess(res, 200, { valid: Boolean(ownerId), ownerId });
  } catch (error) {
    next(error);
  }
};
