import { Router } from 'express';
import { createWithdrawal, getPayoutHistory, getWalletSummary } from '../controllers/withdrawalsController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/wallet-summary', requireAuth, getWalletSummary);
router.get('/history', requireAuth, getPayoutHistory);
router.post('/request', requireAuth, createWithdrawal);

export default router;
