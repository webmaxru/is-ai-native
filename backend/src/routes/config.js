import { Router } from 'express';

export function createConfigRouter(runtime) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ sharingEnabled: runtime.sharingEnabled });
  });

  return router;
}

export default createConfigRouter;
