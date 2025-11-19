import { Router } from 'express';
import statusRoutes from './statusRoutes';
import paymentsRoutes from './paymentsRoutes';
import emailRoutes from './emailRoutes';
import creatorRoutes from './creatorRoutes';
import adminRoutes from './adminRoutes';
import livesRoutes from './livesRoutes';

const router = Router();

router.use('/', statusRoutes);
router.use('/', paymentsRoutes);
router.use('/', emailRoutes);
router.use('/', livesRoutes);
router.use('/', creatorRoutes);
router.use('/admin', adminRoutes);

export default router;
