import { Router } from 'express';
import {
  registerCreator,
  getCreatorBalanceController,
  getCreatorCommissionsController,
  getCreatorReferralController,
  createReferralCodeController,
  submitWithdrawalController,
  getWithdrawalHistoryController,
} from '../controllers/creatorsController';
import { requireAuth, requireCreatorAccount } from '../middleware/authMiddleware';
import { withdrawalRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/creators/register', requireAuth, registerCreator);
router.get('/creators/balance', requireAuth, requireCreatorAccount, getCreatorBalanceController);
router.get('/creators/commissions', requireAuth, requireCreatorAccount, getCreatorCommissionsController);
router.get('/creators/referrals', requireAuth, requireCreatorAccount, getCreatorReferralController);
router.post('/creators/referral-code', requireAuth, requireCreatorAccount, createReferralCodeController);
router.post(
  '/creators/withdraw',
  requireAuth,
  requireCreatorAccount,
  withdrawalRateLimiter,
  submitWithdrawalController,
);
router.get('/creators/withdraw/history', requireAuth, requireCreatorAccount, getWithdrawalHistoryController);

export default router;
