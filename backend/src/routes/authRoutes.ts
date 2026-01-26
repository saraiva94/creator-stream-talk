import { Router } from 'express';
import { resolveUsername, validateResetCredentialHandler } from '../controllers/authController';

const router = Router();

router.get('/auth/resolve-username', resolveUsername);
router.post('/auth/validate-reset-credential', validateResetCredentialHandler);

export default router;
