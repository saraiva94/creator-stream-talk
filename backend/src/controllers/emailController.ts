import { Request, Response, NextFunction } from 'express';
import { respondSuccess } from '../lib/responses';
import { sendTransactionalEmail } from '../services/emailService';
import { parseWithZod } from '../validation/utils';
import { sendEmailSchema } from '../validation/emailSchemas';

export const handleSendEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseWithZod(sendEmailSchema, req.body ?? {});
    const result = await sendTransactionalEmail(payload);
    return respondSuccess(res, 202, result);
  } catch (error) {
    next(error);
  }
};
