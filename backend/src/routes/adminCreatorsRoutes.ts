import { Router } from 'express';
import { listCreators, toggleCreatorApproval } from '../controllers/adminCreatorsController';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/creators', listCreators);
router.patch('/creators/:id/approval', toggleCreatorApproval);

export default router;
