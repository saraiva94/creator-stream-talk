import { Router } from 'express';
import { getCreditsBalanceController } from '../controllers/creditsController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/credits/balance', requireAuth, getCreditsBalanceController);

export default router;
