import { Router } from 'express';
import {
  handleCreateRoom,
  handleCreateHostToken,
  handleCreateViewerToken,
} from '../controllers/dailyController';

const router = Router();

router.post('/daily/create-room', handleCreateRoom);
router.post('/daily/create-host-token', handleCreateHostToken);
router.post('/daily/create-viewer-token', handleCreateViewerToken);

export default router;
