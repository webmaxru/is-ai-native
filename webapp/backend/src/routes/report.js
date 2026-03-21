import { Router } from 'express';
import { saveReport, getReport } from '../services/storage.js';
import { trackReportCreated, trackSharedReportViewed } from '../services/app-insights.js';
import { normalizeSharedReportResult } from '../services/shared-report-validator.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createReportRouter(runtime) {
  const router = Router();

  router.post('/', (req, res) => {
    if (!runtime.sharingEnabled) {
      return res.status(503).json({ error: 'Sharing is not enabled' });
    }

    const { result } = req.body;

    if (!result || typeof result !== 'object') {
      return res.status(400).json({ error: 'result object is required' });
    }

    let normalizedResult;
    try {
      normalizedResult = normalizeSharedReportResult(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const id = saveReport(normalizedResult);
    void trackReportCreated(normalizedResult, { reportId: id });
    const url = `/_/report/${id}`;

    return res.status(201).json({ id, url });
  });

  router.get('/:id', (req, res) => {
    if (!runtime.sharingEnabled) {
      return res.status(503).json({ error: 'Sharing is not enabled' });
    }

    const { id } = req.params;

    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid report ID format' });
    }

    const result = getReport(id);
    if (!result) {
      return res.status(404).json({ error: 'Report not found or expired' });
    }

    void trackSharedReportViewed(result, { reportId: id });

    return res.json(result);
  });

  return router;
}

export default createReportRouter;
