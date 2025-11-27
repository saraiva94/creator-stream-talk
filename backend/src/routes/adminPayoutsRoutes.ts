import { Router } from 'express';
import { approve, listPending, reject } from '../controllers/adminPayoutsController';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/payouts/pending', listPending);
router.post('/payouts/:id/approve', approve);
router.post('/payouts/:id/reject', reject);

export default router;
