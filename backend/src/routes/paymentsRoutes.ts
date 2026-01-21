import { Router } from 'express';

const router = Router();

/**
 * DEPRECATED: Mercado Pago payment routes have been discontinued.
 * All payments are now processed via Velana PIX through Supabase Edge Functions:
 * - Credits: supabase/functions/create-velana-payment (purchaseType: 'credits')
 * - Registration: supabase/functions/create-velana-payment (purchaseType: 'registration')
 * - SuperChat: supabase/functions/create-velana-payment (purchaseType: 'superchat')
 * - Webhooks: supabase/functions/velana-webhook
 * 
 * The old Mercado Pago endpoints have been removed:
 * - POST /payments/create-preference (removed)
 * - POST /payments/create-registration-preference (removed)
 * - POST /payments/webhook (removed)
 */

// Return 410 Gone for any legacy requests to these endpoints
router.all('/payments/*', (_req, res) => {
  res.status(410).json({
    error: 'Mercado Pago discontinued',
    message: 'All payments are now processed via Velana PIX. Use the Supabase Edge Functions instead.',
    migration: {
      credits: 'POST /functions/v1/create-velana-payment with purchaseType: "credits"',
      registration: 'POST /functions/v1/create-velana-payment with purchaseType: "registration"',
      superchat: 'POST /functions/v1/create-velana-payment with purchaseType: "superchat"',
      webhook: 'Configure Velana webhook to /functions/v1/velana-webhook',
    },
  });
});

export default router;
