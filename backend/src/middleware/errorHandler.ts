import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';
import { respondError } from '../lib/responses';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = (err as { status?: number }).status ?? 500;
  const message = status >= 500 ? 'Internal server error' : (err as Error).message || 'Request failed';

  logger.error({
    event: 'request.error',
    path: req.originalUrl,
    method: req.method,
    status,
    error: (err as Error).message,
    stack: (err as Error).stack,
  });

  respondError(res, status, message);
};
