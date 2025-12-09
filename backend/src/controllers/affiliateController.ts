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

    // Sum from affiliate_logs where user is direct_referrer OR root_creator
    const { data: logsAsDirect, error: directError } = await supabase
      .from('affiliate_logs')
      .select('amount_direct')
      .eq('direct_referrer', profileId);

    if (directError) {
      throw new Error(`Failed to load affiliate logs (direct): ${directError.message}`);
    }

    const { data: logsAsRoot, error: rootError } = await supabase
      .from('affiliate_logs')
      .select('amount_root')
      .eq('root_creator', profileId);

    if (rootError) {
      throw new Error(`Failed to load affiliate logs (root): ${rootError.message}`);
    }

    const directEarnings = (logsAsDirect ?? []).reduce((acc, row) => acc + (row.amount_direct ?? 0), 0);
    const rootEarnings = (logsAsRoot ?? []).reduce((acc, row) => acc + (row.amount_root ?? 0), 0);
    const totalEarningsCents = directEarnings + rootEarnings;

    // Also get from profiles.affiliate_earnings as source of truth
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('affiliate_earnings, balance')
      .eq('id', profileId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load profile: ${profileError.message}`);
    }

    const affiliateEarningsCents = profileRow?.affiliate_earnings ?? 0;
    const availableBalanceCents = Math.round(((profileRow?.balance as number | null) ?? 0) * 100);

    // Count referrals from multiple sources for robustness
    const { count: regReferralCount } = await supabase
      .from('registration_referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', profileId);

    const { count: profileReferralCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_direct', profileId);

    // Use the maximum count from either source
    const referralCount = Math.max(regReferralCount ?? 0, profileReferralCount ?? 0);

    return respondSuccess(res, 200, {
      totalEarningsCents: Math.max(totalEarningsCents, affiliateEarningsCents),
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

    // Get history from affiliate_logs where user is direct_referrer OR root_creator
    const { data, error } = await supabase
      .from('affiliate_logs')
      .select('id, created_at, amount_direct, amount_root, event_type, new_user, direct_referrer, root_creator')
      .or(`direct_referrer.eq.${profileId},root_creator.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to load affiliate history: ${error.message}`);
    }

    const history = (data ?? []).map((row) => {
      const isDirect = row.direct_referrer === profileId;
      const isRoot = row.root_creator === profileId && !isDirect;
      const amountCents = isDirect ? (row.amount_direct ?? 0) : (row.amount_root ?? 0);
      const level = isDirect ? 1 : 2;

      return {
        id: row.id,
        createdAt: row.created_at,
        amountCents,
        level,
        eventType: row.event_type,
        referredUserId: row.new_user ?? null,
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
