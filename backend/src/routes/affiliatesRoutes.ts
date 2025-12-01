import { Router } from 'express';
import {
  getAffiliateCode,
  registerAffiliate,
  updateAffiliateCode,
  validateAffiliateCode,
} from '../controllers/affiliatesController';
import { requireAuth } from '../middleware/authMiddleware';
import { paymentsRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/affiliates/code', requireAuth, getAffiliateCode);
router.post('/affiliates/code', requireAuth, updateAffiliateCode);
router.get('/affiliates/validate', validateAffiliateCode);
router.post('/affiliates/register', requireAuth, paymentsRateLimiter, registerAffiliate);

export default router;
