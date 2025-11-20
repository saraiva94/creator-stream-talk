import { Router } from 'express';
import {
  getDiagnosticsStatus,
  getHealthStatus,
  getStatus,
  getVersionStatus,
  getDeploymentChecklistStatus,
} from '../controllers/statusController';

const router = Router();

router.get('/status', getStatus);
router.get('/status/health', getHealthStatus);
router.get('/status/version', getVersionStatus);
router.get('/status/diagnostics', getDiagnosticsStatus);
router.get('/status/checklist', getDeploymentChecklistStatus);

export default router;
