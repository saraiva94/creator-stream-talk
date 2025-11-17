import { Request, Response } from 'express';
import { getStatusMessage } from '../services/statusService';

export const getStatus = (_req: Request, res: Response) => {
  const status = getStatusMessage();
  res.send(status);
};
