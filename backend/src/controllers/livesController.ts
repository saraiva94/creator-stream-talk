import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { respondError, respondSuccess } from '../lib/responses';
import {
  ensureCreatorOwnsLive,
  getLiveWithCreator,
  hasLiveAccess,
  listLivesForCreator,
  listPublicLives,
  saveLiveRoomName,
  updateLiveLifecycleStatus,
} from '../services/supabaseService';
import { parseWithZod } from '../validation/utils';
import { liveIdentifierSchema } from '../validation/livesSchemas';
import { supabase } from '../lib/supabaseClient';
import { createLiveConsumptionService } from '../services/liveConsumptionService';

const liveConsumptionService = createLiveConsumptionService({ client: supabase });

export const getPublicLivesController = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const lives = await listPublicLives();
    return respondSuccess(res, 200, { lives });
  } catch (error) {
    next(error);
  }
};

export const getCreatorLivesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.auth?.creatorId;

    if (!creatorId) {
      return respondError(res, 403, 'Creator account required');
    }

    const lives = await listLivesForCreator(creatorId);
    return respondSuccess(res, 200, { lives });
  } catch (error) {
    next(error);
  }
};

export const startLiveController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    const creatorId = req.auth?.creatorId;
    if (!profileId || !creatorId) {
      return respondError(res, 403, 'Creator authentication required');
    }

    const { liveId } = parseWithZod(liveIdentifierSchema, req.body ?? {});
    const live = await ensureCreatorOwnsLive(liveId, profileId);

  const { data: approvalRow, error: approvalError } = await supabase
    .from('creator_profiles')
    .select('approved_for_live')
    .eq('id', profileId)
    .maybeSingle();

    if (approvalError) {
      throw new Error(`Failed to verify creator approval: ${approvalError.message}`);
    }

  if (!approvalRow || approvalRow.approved_for_live !== true) {
    return respondError(res, 403, 'Creator not approved for live streaming');
  }

    if (live.status === 'ended') {
      return respondError(res, 409, 'This live has already ended');
    }

    // LiveKit: room is created automatically when host joins via livekit-room edge function
    // Just update status - the frontend will call the edge function to get the token
    const roomName = `live-${liveId}`;
    await saveLiveRoomName(liveId, roomName);
    await updateLiveLifecycleStatus(liveId, 'waiting_for_host');

    logger.info({ event: 'livekit.live.started', liveId, creatorId });

    return respondSuccess(res, 201, { liveId, roomName, accessUrl: null });
  } catch (error) {
    next(error);
  }
};

export const getLiveInfoController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawLiveId = req.params?.liveId ?? req.body?.liveId ?? req.query?.liveId;
    const { liveId } = parseWithZod(liveIdentifierSchema, { liveId: rawLiveId });
    const live = await getLiveWithCreator(liveId);

    if (!live) {
      return respondError(res, 404, 'Live not found');
    }

    const roomName = live.room_name ?? null;

    return respondSuccess(res, 200, {
      liveId: live.id,
      title: live.title,
      status: live.status,
      roomName,
    });
  } catch (error) {
    next(error);
  }
};

export const requestViewerAccessController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const { liveId } = parseWithZod(liveIdentifierSchema, req.body ?? {});
    const hasAccessGrant = await hasLiveAccess(profileId, liveId);
    if (!hasAccessGrant) {
      return respondError(res, 403, 'User does not have access to this live');
    }

    const live = await getLiveWithCreator(liveId);
    if (!live || !live.room_name) {
      return respondError(res, 404, 'Live is not ready for viewing');
    }

    if (live.status === 'ended') {
      return respondError(res, 409, 'Live is no longer active');
    }

    // LiveKit: viewer gets token from livekit-room edge function
    logger.info({ event: 'livekit.viewer.access_granted', liveId, viewerId: profileId });

    return respondSuccess(res, 200, { liveId, accessUrl: null });
  } catch (error) {
    next(error);
  }
};

export const heartbeatViewerController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const rawLiveId = req.params?.liveId ?? req.body?.liveId;
    const sessionToken = (req.body?.sessionToken ?? req.headers['x-session-token']) as string | undefined;

    if (!sessionToken || typeof sessionToken !== 'string') {
      return respondError(res, 400, 'Missing session token');
    }

    const { liveId } = parseWithZod(liveIdentifierSchema, { liveId: rawLiveId });

    const entitled = await hasLiveAccess(profileId, liveId);
    if (!entitled) {
      return respondError(res, 403, 'Access denied for this live');
    }

    const result = await liveConsumptionService.applyHeartbeatAndChargeCredits({
      liveId,
      userId: profileId,
      sessionToken,
      now: new Date(),
    });

    const { data: walletRow, error: walletError } = await supabase
      .from('credits_wallet')
      .select('balance_credits')
      .eq('user_id', profileId)
      .maybeSingle();

    if (walletError) {
      throw new Error(`Failed to fetch viewer wallet: ${walletError.message}`);
    }

    const remainingCredits = Math.max(0, walletRow?.balance_credits ?? 0);

    if (result.ranOutOfCredits) {
      await supabase.from('live_access').delete().eq('live_id', liveId).eq('user_id', profileId);
    }

    return respondSuccess(res, 200, {
      status: result.ranOutOfCredits ? 'NO_CREDITS' : 'OK',
      secondsWatched: result.secondsWatched,
      creditsConsumed: result.creditsConsumed,
      creditsChargedThisTick: result.creditsChargedThisTick,
      ranOutOfCredits: result.ranOutOfCredits,
      remainingCredits,
    });
  } catch (error) {
    next(error);
  }
};
