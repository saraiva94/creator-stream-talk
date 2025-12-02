import { Router } from 'express';
import { resolveUsername } from '../controllers/authController';

const router = Router();

router.get('/auth/resolve-username', resolveUsername);

export default router;
