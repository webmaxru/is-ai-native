import { Router } from 'express';
import { saveReport, getReport } from '../services/storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const router = Router();

router.post('/', (req, res) => {
  const { result } = req.body;

  if (!result || typeof result !== 'object') {
    return res.status(400).json({ error: 'result object is required' });
  }

  const id = saveReport(result);
  const host = req.get('host');
  const protocol = req.protocol;
  const url = `${protocol}://${host}/report/${id}`;

  return res.status(201).json({ id, url });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Invalid report ID format' });
  }

  const result = getReport(id);
  if (!result) {
    return res.status(404).json({ error: 'Report not found or expired' });
  }

  return res.json(result);
});

export default router;
