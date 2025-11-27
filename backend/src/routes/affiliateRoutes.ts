import { Router } from 'express';
import { getAffiliateHistory, getAffiliateLink, getAffiliateOverview } from '../controllers/affiliateController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/affiliate/overview', requireAuth, getAffiliateOverview);
router.get('/affiliate/history', requireAuth, getAffiliateHistory);
router.get('/affiliate/link', requireAuth, getAffiliateLink);

export default router;
