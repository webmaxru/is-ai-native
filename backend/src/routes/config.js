import { Router } from 'express';

export function createConfigRouter(runtime) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      sharingEnabled: runtime.sharingEnabled,
      appInsightsConnectionString: runtime.appInsightsWebConnectionString || null,
      containerStartupStrategy: runtime.containerStartupStrategy,
      containerMinReplicas: runtime.containerMinReplicas,
    });
  });

  return router;
}

export default createConfigRouter;
