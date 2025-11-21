import { Router } from 'express';
import { registerAffiliate } from '../controllers/affiliatesController';
import { requireAuth } from '../middleware/authMiddleware';
import { paymentsRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/affiliates/register', requireAuth, paymentsRateLimiter, registerAffiliate);

export default router;
