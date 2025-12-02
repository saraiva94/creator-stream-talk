import { Router } from 'express';
import {
  getCreatorLivesController,
  getLiveInfoController,
  getPublicLivesController,
  heartbeatViewerController,
  requestViewerAccessController,
  startLiveController,
} from '../controllers/livesController';
import { requireAuth, requireCreatorAccount } from '../middleware/authMiddleware';
import { viewerAccessRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/lives/public', getPublicLivesController);
router.get('/lives/creator', requireAuth, requireCreatorAccount, getCreatorLivesController);
router.post('/lives/start', requireAuth, requireCreatorAccount, startLiveController);
router.get('/lives/:liveId/info', requireAuth, getLiveInfoController);
router.post('/lives/access', requireAuth, viewerAccessRateLimiter, requestViewerAccessController);
router.post('/lives/:liveId/heartbeat', requireAuth, viewerAccessRateLimiter, heartbeatViewerController);

export default router;
