import { Router } from 'express';

const router = Router();

router.all(/^\/payments(?:\/.*)?$/, (_req, res) => {
  res.status(410).json({ error: 'Pagamentos indisponíveis.' });
});

export default router;
