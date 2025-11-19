import { Router } from 'express';
import { handleSendEmail } from '../controllers/emailController';
import { emailRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/email/send', emailRateLimiter, handleSendEmail);

export default router;
