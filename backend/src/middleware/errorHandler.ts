import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import logger from '../lib/logger';
import { respondError } from '../lib/responses';

type RequestWithMeta = Request & {
  requestId?: string;
};

type AppError = Error & {
  status?: number;
  statusCode?: number;
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  const reqWithMeta = req as RequestWithMeta;

  const existingRequestId = reqWithMeta.requestId;
  const requestId = existingRequestId ?? randomUUID();
  reqWithMeta.requestId = requestId;

  const appError = err as AppError;

  const statusFromErr = appError.status ?? appError.statusCode;
  const status =
    typeof statusFromErr === 'number' && statusFromErr > 0 ? statusFromErr : 500;

  const isError = err instanceof Error;
  const rawMessage = isError ? err.message : 'Request failed';

  const message =
    status >= 500 ? 'Internal server error' : rawMessage || 'Request failed';

  logger.error({
    event: 'request.error',
    requestId,
    path: req.originalUrl,
    method: req.method,
    status,
    error: rawMessage,
    stack: appError.stack,
  });

  res.setHeader('X-Request-Id', requestId);

  respondError(res, status, message);
};
