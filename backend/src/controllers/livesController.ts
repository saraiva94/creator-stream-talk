import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { respondError, respondSuccess } from '../lib/responses';
import {
  ensureCreatorOwnsLive,
  getLiveWithCreator,
  getLiveAccessWithCredits,
  getLiveAnalyticsSnapshot,
  listLivesForCreator,
  listPublicLives,
  saveLiveRoomName,
  updateLiveLifecycleStatus,
} from '../services/supabaseService';
import { parseWithZod } from '../validation/utils';
import { liveIdentifierSchema } from '../validation/livesSchemas';
import { createPrivateRoom, generateAccessLink } from '../services/jitsiService';

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

    if (live.status === 'ended') {
      return respondError(res, 409, 'This live has already ended');
    }

    const { roomName } = await createPrivateRoom(creatorId);
    await saveLiveRoomName(liveId, roomName);
    await updateLiveLifecycleStatus(liveId, 'waiting_for_host');

    const accessUrl = generateAccessLink(roomName);
    logger.info({ event: 'jitsi.live.started', liveId, creatorId });

    return respondSuccess(res, 201, { liveId, roomName, accessUrl });
  } catch (error) {
    next(error);
  }
};

const resolvePreviewSeconds = (role: 'anonymous' | 'authenticated') =>
  role === 'anonymous' ? 30 : 10;

export const getLiveInfoController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId ?? null;

    const rawLiveId = req.params?.liveId ?? req.body?.liveId ?? req.query?.liveId;
    const { liveId } = parseWithZod(liveIdentifierSchema, { liveId: rawLiveId });
    const live = await getLiveWithCreator(liveId);

    if (!live) {
      return respondError(res, 404, 'Live not found');
    }

    const isCreator = Boolean(profileId && profileId === live.creator_profile_id);
    let creditBalance = 0;
    let isBlockedForCredits = false;
    let creditsConsumed = 0;
    let requiresPayment = true;
    let isEntitled = false;
    const previewSeconds = resolvePreviewSeconds(profileId ? 'authenticated' : 'anonymous');

    if (isCreator) {
      requiresPayment = false;
      isEntitled = true;
    } else if (profileId) {
      const accessState = await getLiveAccessWithCredits(profileId, liveId);
      creditBalance = accessState.creditBalance;
      isBlockedForCredits = accessState.isBlockedForCredits;
      creditsConsumed = accessState.creditsConsumed;
      requiresPayment = !accessState.hasAccess;
      isEntitled = accessState.hasAccess && accessState.creditBalance > 0;
    }

    const roomName = live.room_name ?? null;
    const jitsiUrl = roomName ? generateAccessLink(roomName) : null;

    return respondSuccess(res, 200, {
      liveId: live.id,
      title: live.title,
      status: live.status,
      roomName,
      jitsiUrl,
      price: live.price,
      currency: live.currency,
      requiresPayment,
      isEntitled,
      credit_balance: creditBalance,
      is_blocked_for_credits: isBlockedForCredits,
      credits_consumed: creditsConsumed,
      preview_seconds: previewSeconds,
    });
  } catch (error) {
    next(error);
  }
};

export const reconnectLiveAccessController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId ?? null;
    const rawLiveId = req.params?.liveId ?? req.body?.liveId ?? req.query?.liveId;
    const { liveId } = parseWithZod(liveIdentifierSchema, { liveId: rawLiveId });
    const live = await getLiveWithCreator(liveId);

    if (!live) {
      return respondError(res, 404, 'Live not found');
    }

    const roomName = live.room_name ?? null;
    const jitsiUrl = roomName ? generateAccessLink(roomName) : null;

    if (!profileId) {
      return respondSuccess(res, 200, {
        access: 'preview',
        credits: 0,
        remaining_preview_seconds: resolvePreviewSeconds('anonymous'),
        roomName,
        jitsiUrl,
      });
    }

    const accessState = await getLiveAccessWithCredits(profileId, liveId);

    if (accessState.hasAccess && accessState.creditBalance > 0) {
      return respondSuccess(res, 200, {
        access: 'granted',
        credits: accessState.creditBalance,
        remaining_preview_seconds: 0,
        roomName,
        jitsiUrl,
      });
    }

    if (accessState.hasAccess && accessState.creditBalance <= 0) {
      return respondSuccess(res, 200, {
        access: 'blocked',
        credits: 0,
        remaining_preview_seconds: 0,
        roomName,
        jitsiUrl,
      });
    }

    return respondSuccess(res, 200, {
      access: 'preview',
      credits: accessState.creditBalance ?? 0,
      remaining_preview_seconds: resolvePreviewSeconds('authenticated'),
      roomName,
      jitsiUrl,
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
    const accessState = await getLiveAccessWithCredits(profileId, liveId);
    if (!accessState.hasAccess) {
      return respondError(res, 403, 'User does not have access to this live');
    }

    if (accessState.creditBalance <= 0) {
      return respondError(res, 402, 'Insufficient credits');
    }

    const live = await getLiveWithCreator(liveId);
    if (!live || !live.room_name) {
      return respondError(res, 404, 'Live is not ready for viewing');
    }

    if (live.status === 'ended') {
      return respondError(res, 409, 'Live is no longer active');
    }

    const accessUrl = generateAccessLink(live.room_name);
    logger.info({ event: 'jitsi.viewer.access_granted', liveId, viewerId: profileId });

    return respondSuccess(res, 200, {
      liveId,
      accessUrl,
      credit_balance: accessState.creditBalance,
      credits_consumed: accessState.creditsConsumed,
    });
  } catch (error) {
    next(error);
  }
};

export const getLiveAnalyticsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    const creatorId = req.auth?.creatorId;

    if (!profileId || !creatorId) {
      return respondError(res, 403, 'Creator authentication required');
    }

    const rawLiveId = req.params?.liveId ?? req.body?.liveId ?? req.query?.liveId;
    const { liveId } = parseWithZod(liveIdentifierSchema, { liveId: rawLiveId });

    await ensureCreatorOwnsLive(liveId, profileId);
    const analytics = await getLiveAnalyticsSnapshot(liveId);

    return respondSuccess(res, 200, analytics);
  } catch (error) {
    next(error);
  }
};
