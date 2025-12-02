import { Router } from 'express';
import { createPreference, createRegistrationPreference, webhook } from '../controllers/paymentsController';
import { paymentsRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/payments/create-preference', paymentsRateLimiter, createPreference);
router.post('/payments/create-registration-preference', paymentsRateLimiter, createRegistrationPreference);
router.post('/payments/webhook', webhook);

export default router;
