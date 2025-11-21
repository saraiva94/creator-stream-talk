import { Router } from 'express';
import { createPayment, webhook } from '../controllers/paymentsController';
import { requireAuth } from '../middleware/authMiddleware';
import { paymentsRateLimiter } from '../middleware/rateLimit';
import { mercadoPagoWebhookParser } from '../middleware/rawBodyParsers';
import { webhookDomainGuard } from '../middleware/webhookDomainGuard';

const router = Router();

router.post('/payments/create', requireAuth, paymentsRateLimiter, createPayment);
router.post('/payments/webhook', ...mercadoPagoWebhookParser, webhookDomainGuard.mercadopago, webhook);

export default router;
