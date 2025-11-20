import { Router } from 'express';
import {
  getCreatorLivesController,
  getLiveInfoController,
  getPublicLivesController,
  requestViewerAccessController,
  startLiveController,
} from '../controllers/livesController';
import { requireAuth, requireCreatorAccount } from '../middleware/authMiddleware';
import { viewerAccessRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/lives/public', getPublicLivesController);
router.get('/lives', getPublicLivesController);
router.get('/lives/creator', requireAuth, requireCreatorAccount, getCreatorLivesController);
router.post('/lives/start', requireAuth, requireCreatorAccount, startLiveController);
router.get('/lives/:liveId/info', requireAuth, getLiveInfoController);
router.post('/lives/access', requireAuth, viewerAccessRateLimiter, requestViewerAccessController);

export default router;
