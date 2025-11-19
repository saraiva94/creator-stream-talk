import { z } from 'zod';

export const sendEmailSchema = z.object({
  to: z.string().email('A valid email is required'),
  type: z.enum(['payment_receipt', 'access_granted', 'live_starting']),
  data: z.record(z.string(), z.unknown()).optional(),
});
