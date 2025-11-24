import { Router } from 'express';
import statusRoutes from './statusRoutes';
import dailyRoutes from './dailyRoutes';
import paymentsRoutes from './paymentsRoutes';
import adminRoutes from './adminRoutes';
import creatorRoutes from './creatorRoutes';
import livesRoutes from './livesRoutes';
import emailRoutes from './emailRoutes';

const router = Router();

router.use('/', statusRoutes);
router.use('/', dailyRoutes);
router.use('/', paymentsRoutes);
router.use('/', adminRoutes);
router.use('/', creatorRoutes);
router.use('/', livesRoutes);
router.use('/', emailRoutes);

export default router;
