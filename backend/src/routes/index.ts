import { Router } from 'express';
import statusRoutes from './statusRoutes';
import dailyRoutes from './dailyRoutes';
import paymentsRoutes from './paymentsRoutes';

const router = Router();

router.use('/', statusRoutes);
router.use('/', dailyRoutes);
router.use('/', paymentsRoutes);

export default router;
