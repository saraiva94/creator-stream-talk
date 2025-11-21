import { Router } from 'express';
import statusRoutes from './statusRoutes';
import paymentsRoutes from './paymentsRoutes';
import emailRoutes from './emailRoutes';
import creatorRoutes from './creatorRoutes';
import adminRoutes from './adminRoutes';
import livesRoutes from './livesRoutes';
import creditsRoutes from './creditsRoutes';
import affiliatesRoutes from './affiliatesRoutes';
import registrationRoutes from './registrationRoutes';

const router = Router();

router.use('/', statusRoutes);
router.use('/', paymentsRoutes);
router.use('/', emailRoutes);
router.use('/', livesRoutes);
router.use('/', creatorRoutes);
router.use('/', creditsRoutes);
router.use('/', affiliatesRoutes);
router.use('/', registrationRoutes);
router.use('/admin', adminRoutes);

export default router;
