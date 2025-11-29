import { Router } from 'express';
import { listCreatorEarnings } from '../controllers/creatorEarningsController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/creator/earnings', requireAuth, listCreatorEarnings);

export default router;
