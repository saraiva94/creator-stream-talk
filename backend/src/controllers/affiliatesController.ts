import { Request, Response, NextFunction } from 'express';
import { respondError, respondSuccess } from '../lib/responses';
import { ensureReferralCode } from '../services/affiliateService';
import { parseWithZod } from '../validation/utils';
import { referralCodeSchema } from '../validation/affiliateSchemas';
import { supabase } from '../lib/supabaseClient';

export const registerAffiliate = (_req: Request, res: Response) =>
  respondError(res, 410, 'Cadastro pago indisponível.');

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
