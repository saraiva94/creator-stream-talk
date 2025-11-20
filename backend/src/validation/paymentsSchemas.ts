import { z } from 'zod';

export const createPaymentSchema = z.object({
  liveId: z.string().min(1, 'liveId is required'),
});
