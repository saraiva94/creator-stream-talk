import { z } from 'zod';

export const liveIdentifierSchema = z.object({
  liveId: z.string().min(1, 'liveId is required'),
});
