import { Router } from 'express';
import { approveWithdrawal, listPendingWithdrawals, markWithdrawalPaidHandler, rejectWithdrawal } from '../controllers/adminWithdrawalsController';
import { generateFreeRegistrationLink, markRootCreator } from '../controllers/affiliateAdminController';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/withdrawals/pending', listPendingWithdrawals);
router.post('/withdrawals/approve', approveWithdrawal);
router.post('/withdrawals/reject', rejectWithdrawal);
router.post('/withdrawals/mark-paid', markWithdrawalPaidHandler);
router.post('/mark-root-creator', markRootCreator);
router.get('/affiliate/free-registration-link', generateFreeRegistrationLink);

export default router;
