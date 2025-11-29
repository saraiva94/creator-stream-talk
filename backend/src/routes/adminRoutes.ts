import { Router } from 'express';
import { approveWithdrawal, listPendingWithdrawals, markWithdrawalPaidHandler, rejectWithdrawal } from '../controllers/adminWithdrawalsController';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/withdrawals/pending', listPendingWithdrawals);
router.post('/withdrawals/approve', approveWithdrawal);
router.post('/withdrawals/reject', rejectWithdrawal);
router.post('/withdrawals/mark-paid', markWithdrawalPaidHandler);

export default router;
