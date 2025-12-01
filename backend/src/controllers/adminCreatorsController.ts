import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { respondError, respondSuccess } from '../lib/responses';

type CreatorProfileRow = {
  id: string;
  approved_for_live: boolean | null;
  created_at: string;
  profiles?: {
    email?: string | null;
    username?: string | null;
  } | null;
};

const mapCreatorRow = (row: CreatorProfileRow) => ({
  id: row.id,
  email: row.profiles?.email ?? null,
  username: row.profiles?.username ?? null,
  isApprovedForLive: Boolean(row.approved_for_live),
  createdAt: row.created_at,
});

export const listCreators = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('creator_profiles')
      .select(
        `
          id,
          user_id,
          approved_for_live,
          created_at,
          profiles:user_id (
            username,
            email
          )
        `,
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list creators: ${error.message}`);
    }

    return respondSuccess(res, 200, (data ?? []).map(mapCreatorRow));
  } catch (error) {
    next(error);
  }
};

export const toggleCreatorApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.params?.id ?? req.body?.creatorId;
    const isApproved = req.body?.isApproved;

    if (!creatorId) {
      return respondError(res, 400, 'creatorId is required');
    }

    if (typeof isApproved !== 'boolean') {
      return respondError(res, 400, 'isApproved must be boolean');
    }

    const { data: existing, error: loadError } = await supabase
      .from('creator_profiles')
      .select(
        `
          id,
          approved_for_live,
          created_at,
          profiles:user_id (
            username,
            email
          )
        `,
      )
      .eq('id', creatorId)
      .maybeSingle();

    if (loadError) {
      throw new Error(`Failed to load creator profile: ${loadError.message}`);
    }

    if (!existing) {
      return respondError(res, 404, 'Creator not found');
    }

    const { data: updated, error: updateError } = await supabase
      .from('creator_profiles')
      .update({ approved_for_live: isApproved })
      .eq('id', creatorId)
      .select(
        `
          id,
          approved_for_live,
          created_at,
          profiles:user_id (
            username,
            email
          )
        `,
      )
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update creator approval: ${updateError.message}`);
    }

    return respondSuccess(res, 200, mapCreatorRow(updated ?? existing));
  } catch (error) {
    next(error);
  }
};
