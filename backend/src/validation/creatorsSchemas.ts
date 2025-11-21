import { z } from 'zod';

const priceTransformer = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}, z.number().min(0, 'pricePerMinute must be a positive number').optional());

export const registerCreatorSchema = z.object({
  bio: z.string().max(2000).optional(),
  pricePerMinute: priceTransformer,
  referralCode: z
    .string()
    .trim()
    .min(3, 'referralCode must be at least 3 characters')
    .max(64, 'referralCode must be 64 characters or less')
    .optional(),
});
