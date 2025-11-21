import { Router } from 'express';
import {
  getCreatorLivesController,
  getLiveInfoController,
  getLiveAnalyticsController,
  getPublicLivesController,
  reconnectLiveAccessController,
  requestViewerAccessController,
  startLiveController,
} from '../controllers/livesController';
import { optionalAuth, requireAuth, requireCreatorAccount } from '../middleware/authMiddleware';
import { viewerAccessRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/lives/public', getPublicLivesController);
router.get('/lives', getPublicLivesController);
router.get('/lives/creator', requireAuth, requireCreatorAccount, getCreatorLivesController);
router.post('/lives/start', requireAuth, requireCreatorAccount, startLiveController);
router.get('/lives/:liveId/info', optionalAuth, getLiveInfoController);
router.get('/lives/:liveId/reconnect', optionalAuth, reconnectLiveAccessController);
router.get('/lives/:liveId/analytics', requireAuth, requireCreatorAccount, getLiveAnalyticsController);
router.post('/lives/access', requireAuth, viewerAccessRateLimiter, requestViewerAccessController);

export default router;
