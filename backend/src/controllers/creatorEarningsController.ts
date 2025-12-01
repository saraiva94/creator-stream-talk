import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { respondError, respondSuccess } from '../lib/responses';

type CreatorEarningRow = {
  id: string;
  live_id: string;
  credits_consumed: number | null;
  gross_cents: number | null;
  net_cents: number | null;
  platform_cents: number | null;
  status: string | null;
  settled_at: string | null;
  created_at: string;
  lives?: {
    title?: string | null;
    created_at?: string | null;
  } | null;
};

export const listCreatorEarnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.auth?.profileId;
    if (!creatorId) {
      return respondError(res, 401, 'Authentication required');
    }

    const { data, error } = await supabase
      .from('creator_earnings')
      .select(
        `
        id,
        live_id,
        credits_consumed,
        gross_cents,
        net_cents,
        platform_cents,
        status,
        settled_at,
        created_at,
        lives:live_id (
          title,
          created_at
        )
      `,
      )
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load creator earnings: ${error.message}`);
    }

    const earnings = (data ?? []).map((row: CreatorEarningRow) => ({
      id: row.id,
      liveId: row.live_id,
      liveTitle: row.lives?.title ?? null,
      liveCreatedAt: row.lives?.created_at ?? null,
      creditsConsumed: row.credits_consumed,
      grossCents: row.gross_cents,
      netCents: row.net_cents,
      platformCents: row.platform_cents,
      status: row.status,
      settledAt: row.settled_at,
      createdAt: row.created_at,
    }));

    return respondSuccess(res, 200, earnings);
  } catch (error) {
    next(error);
  }
};
