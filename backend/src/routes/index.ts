import { Router } from 'express';
import statusRoutes from './statusRoutes';
import dailyRoutes from './dailyRoutes';
import paymentsRoutes from './paymentsRoutes';
import adminRoutes from './adminRoutes';
import creatorRoutes from './creatorRoutes';
import livesRoutes from './livesRoutes';
import emailRoutes from './emailRoutes';
import creditsRoutes from './creditsRoutes';
import withdrawalsRoutes from './withdrawalsRoutes';
import adminPayoutsRoutes from './adminPayoutsRoutes';
import creatorEarningsRoutes from './creatorEarningsRoutes';
import affiliateRoutes from './affiliateRoutes';
import adminCreatorsRoutes from './adminCreatorsRoutes';

const router = Router();

router.use('/', statusRoutes);
router.use('/', dailyRoutes);
router.use('/', paymentsRoutes);
router.use('/', adminRoutes);
router.use('/', creatorRoutes);
router.use('/', livesRoutes);
router.use('/', emailRoutes);
router.use('/', creditsRoutes);
router.use('/withdrawals', withdrawalsRoutes);
router.use('/admin', adminPayoutsRoutes);
router.use('/admin', adminCreatorsRoutes);
router.use('/', creatorEarningsRoutes);
router.use('/', affiliateRoutes);

export default router;
