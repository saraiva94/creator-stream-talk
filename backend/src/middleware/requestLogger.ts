import { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  logger.info({
    event: 'request.start',
    method: req.method,
    path: req.originalUrl,
  });

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    logger.info({
      event: 'request.finish',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
    });
  });

  next();
};
