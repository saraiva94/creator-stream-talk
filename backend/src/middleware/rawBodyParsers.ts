import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import logger from '../lib/logger';

const jsonContentType = 'application/json';

const buildRawBodyMiddleware = (label: string): RequestHandler[] => {
  const rawParser = express.raw({ type: jsonContentType });

  const ensureRawBody: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (req.rawBody) {
      return next();
    }
    return rawParser(req, res, next);
  };

  const attachRawBody: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffer = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? ''));
      req.rawBody = buffer;
      if (!buffer || buffer.length === 0) {
        req.body = {};
      } else {
        req.body = JSON.parse(buffer.toString('utf8'));
      }
      return next();
    } catch (error) {
      logger.warn({ event: `${label}.invalid_json`, error: (error as Error).message });
      return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }
  };

  return [ensureRawBody, attachRawBody];
};

export const mercadoPagoWebhookParser = buildRawBodyMiddleware('mercadoPagoWebhook');
