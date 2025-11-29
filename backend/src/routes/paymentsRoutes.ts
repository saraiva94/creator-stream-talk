import { Router } from 'express';
import { createPreference, createRegistrationPreference, webhook } from '../controllers/paymentsController';

const router = Router();

router.post('/payments/create-preference', createPreference);
router.post('/payments/create-registration-preference', createRegistrationPreference);
router.post('/payments/webhook', webhook);

export default router;
