import { z } from 'zod';

export const affiliateRegisterSchema = z.object({
  referralCode: z.string().trim().optional().nullable(),
});

export const markRootCreatorSchema = z.object({
  user_id: z.string().uuid(),
});

export const registrationCheckoutSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  referralCode: z.string().trim().optional().nullable(),
  referrer_id: z.string().uuid().optional().nullable(),
  free: z.boolean().optional(),
  root: z.boolean().optional(),
});

export const referralCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Referral code must have at least 4 characters')
    .max(32, 'Referral code is too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, dashes, and underscores are allowed'),
});
