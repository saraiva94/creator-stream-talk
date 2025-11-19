import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';
import { getAllowedOrigins } from '../lib/env';

const allowedOrigins = new Set(getAllowedOrigins());
const allowedMethods = 'GET,POST,PUT,DELETE,OPTIONS';
const allowedHeaders = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (!origin || !allowedOrigins.has(origin)) {
    logger.warn({ event: 'cors.blocked', origin: origin ?? 'unknown' });
    return res.status(403).json({ success: false, error: 'Origin not allowed' });
  }

  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', allowedMethods);
  res.header('Access-Control-Allow-Headers', allowedHeaders);
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
};

export const getCorsMetadata = () => ({
  allowedOrigins: Array.from(allowedOrigins),
  allowedMethods,
  allowedHeaders,
});
