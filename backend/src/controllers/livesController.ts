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
import { createPrivateRoom, generateAccessLink } from '../services/jitsiService';
import { supabase } from '../lib/supabaseClient';

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
      .select('is_verified')
      .eq('id', profileId)
      .maybeSingle();

    if (approvalError) {
      throw new Error(`Failed to verify creator approval: ${approvalError.message}`);
    }

    if (!approvalRow || approvalRow.is_verified !== true) {
      return respondError(res, 403, 'Creator not approved for live streaming');
    }

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

export const getLiveInfoController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = req.auth?.profileId;
    if (!profileId) {
      return respondError(res, 401, 'Authentication required');
    }

    const rawLiveId = req.params?.liveId ?? req.body?.liveId ?? req.query?.liveId;
    const { liveId } = parseWithZod(liveIdentifierSchema, { liveId: rawLiveId });
    const live = await getLiveWithCreator(liveId);

    if (!live) {
      return respondError(res, 404, 'Live not found');
    }

    const isCreator = profileId === live.creator_profile_id;
    if (!isCreator) {
      const entitled = await hasLiveAccess(profileId, liveId);
      if (!entitled) {
        return respondError(res, 403, 'Access denied');
      }
    }

    const roomName = live.room_name ?? null;
    const jitsiUrl = roomName ? generateAccessLink(roomName) : null;

    return respondSuccess(res, 200, {
      liveId: live.id,
      title: live.title,
      status: live.status,
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

    const accessUrl = generateAccessLink(live.room_name);
    logger.info({ event: 'jitsi.viewer.access_granted', liveId, viewerId: profileId });

    return respondSuccess(res, 200, { liveId, accessUrl });
  } catch (error) {
    next(error);
  }
};
