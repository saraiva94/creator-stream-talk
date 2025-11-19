import { Request, Response, NextFunction } from 'express';
import { respondSuccess } from '../lib/responses';
import {
  getDiagnosticsSnapshot,
  getDeploymentChecklist,
  getHealthSnapshot,
  getStatusMessage,
  getVersionInfo,
} from '../services/statusService';

export const getStatus = (_req: Request, res: Response) => {
  return respondSuccess(res, 200, { message: getStatusMessage() });
};

export const getHealthStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await getHealthSnapshot();
    return res.status(200).json({ success: true, ...health });
  } catch (error) {
    next(error);
  }
};

export const getVersionStatus = (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, ...getVersionInfo() });
};

export const getDiagnosticsStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const diagnostics = await getDiagnosticsSnapshot();
    return res.status(200).json({ success: true, ...diagnostics });
  } catch (error) {
    next(error);
  }
};

export const getDeploymentChecklistStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const checklist = await getDeploymentChecklist();
    return res.status(200).json({ success: true, checklist });
  } catch (error) {
    next(error);
  }
};
