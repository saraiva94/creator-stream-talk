import rateLimit from 'express-rate-limit';
import { Request, Response, RequestHandler } from 'express';
import { respondError } from '../lib/responses';

const createLimiter = (limit: number, windowMs = 60_000): RequestHandler =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      respondError(res, 429, 'Too many requests');
    },
  });

export const paymentsRateLimiter = createLimiter(5);
export const emailRateLimiter = createLimiter(10);
export const viewerAccessRateLimiter = createLimiter(20);
export const withdrawalRateLimiter = createLimiter(3);
