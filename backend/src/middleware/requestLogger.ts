import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import logger from '../lib/logger';

type RequestWithMeta = Request & {
  requestId?: string;
  user?: { id?: string | number } | null;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  const requestId = randomUUID();

  const reqWithMeta = req as RequestWithMeta;
  reqWithMeta.requestId = requestId;

  logger.info({
    event: 'request.start',
    requestId,
    method: req.method,
    path: req.originalUrl,
  });

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const userId = reqWithMeta.user?.id ?? null;

    logger.info({
      event: 'request.finish',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      userId,
    });
  });

  next();
};
