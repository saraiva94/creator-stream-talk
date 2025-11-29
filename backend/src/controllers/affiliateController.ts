import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { respondError, respondSuccess } from '../lib/responses';

const safeProfileId = (req: Request) => req.auth?.profileId;

export const getAffiliateOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = safeProfileId(req);
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const { data: sumRows, error: sumError } = await supabase
      .from('transactions')
      .select('affiliate_amount, status')
      .eq('affiliate_id', profileId)
      .eq('type', 'affiliate');

    if (sumError) {
      throw new Error(`Failed to load affiliate transactions: ${sumError.message}`);
    }

    const totalEarningsCents = (sumRows ?? [])
      .filter((row) => (row.status ?? '').toString().toLowerCase() === 'completed')
      .reduce((acc, row) => acc + Math.round((row.affiliate_amount as number | null) ?? 0), 0);

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', profileId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load profile balance: ${profileError.message}`);
    }

    const availableBalanceCents = Math.round(((profileRow?.balance as number | null) ?? 0) * 100);

    const { count: referralCount, error: referralError } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', profileId);

    if (referralError) {
      throw new Error(`Failed to count referrals: ${referralError.message}`);
    }

    return respondSuccess(res, 200, {
      totalEarningsCents,
      availableBalanceCents,
      totalReferrals: referralCount ?? 0,
    });
  } catch (error) {
    next(error);
  }
};

export const getAffiliateHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = safeProfileId(req);
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('id, created_at, affiliate_amount, metadata, user_id')
      .eq('affiliate_id', profileId)
      .eq('type', 'affiliate')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to load affiliate history: ${error.message}`);
    }

    const history = (data ?? []).map((row) => {
      const meta = (row.metadata as Record<string, unknown> | null) || {};
      const level = (meta.level as number | undefined) ?? null;
      return {
        id: row.id,
        createdAt: row.created_at,
        amountCents: Math.round((row.affiliate_amount as number | null) ?? 0),
        level,
        referredUserId: row.user_id ?? null,
      };
    });

    return respondSuccess(res, 200, history);
  } catch (error) {
    next(error);
  }
};

export const getAffiliateLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = safeProfileId(req);
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    // Profiles have a referral_code column; generate if missing by reusing existing code if any trigger is set.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', profileId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load referral code: ${profileError.message}`);
    }

    let referralCode = profile?.referral_code as string | null;

    if (!referralCode) {
      const candidate = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ referral_code: candidate })
        .eq('id', profileId)
        .select('referral_code')
        .maybeSingle();

      if (updateError) {
        throw new Error(`Failed to create referral code: ${updateError.message}`);
      }

      referralCode = updated?.referral_code ?? candidate;
    }

    if (!referralCode) {
      return res.status(500).json({
        success: false,
        message: 'Failed to resolve affiliate referral code',
      });
    }

    const baseUrl = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const cleanedBase = baseUrl.replace(/\/$/, '');
    const url = `${cleanedBase}/invite/${encodeURIComponent(referralCode)}`;

    return respondSuccess(res, 200, { code: referralCode, url });
  } catch (error) {
    next(error);
  }
};
