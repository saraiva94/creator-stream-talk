import { Router } from 'express';
import { createPreference, webhook } from '../controllers/paymentsController';

const router = Router();

router.post('/payments/create-preference', createPreference);
router.post('/payments/webhook', webhook);

export default router;
