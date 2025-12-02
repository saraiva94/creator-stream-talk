import { Router } from 'express';
import { createWithdrawal, getPayoutHistory, getWalletSummary } from '../controllers/withdrawalsController';
import { requireAuth } from '../middleware/authMiddleware';
import { withdrawalRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/wallet-summary', requireAuth, getWalletSummary);
router.get('/history', requireAuth, getPayoutHistory);
router.post('/request', requireAuth, withdrawalRateLimiter, createWithdrawal);

export default router;
