import { Router } from 'express';
import { registrationCheckout } from '../controllers/registrationController';
import { paymentsRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/registration/checkout', paymentsRateLimiter, registrationCheckout);

export default router;
