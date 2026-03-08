import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ sharingEnabled: process.env.ENABLE_SHARING === 'true' });
});

export default router;
