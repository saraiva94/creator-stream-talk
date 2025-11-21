import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import {
  consumeCreditsController,
  getBalanceController,
  purchaseCreditsController,
} from '../controllers/creditsController';

const router = Router();

router.get('/credits/balance', requireAuth, getBalanceController);
router.post('/credits/purchase', requireAuth, purchaseCreditsController);
router.post('/credits/consume', requireAuth, consumeCreditsController);

export default router;
