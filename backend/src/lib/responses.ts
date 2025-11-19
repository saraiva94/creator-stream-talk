import { Response } from 'express';

export const respondSuccess = <T>(res: Response, statusCode: number, data: T) => {
  return res.status(statusCode).json({ success: true, data });
};

export const respondError = (res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).json({ success: false, error: message });
};
