import { z } from 'zod';

export const submitWithdrawalSchema = z.object({
  amount: z.preprocess((value) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    return value;
  }, z.number().positive('amount must be a positive number')),
});

export const withdrawalActionSchema = z.object({
  withdrawalId: z.string().min(1, 'withdrawalId is required'),
  note: z.string().max(500).optional(),
});
