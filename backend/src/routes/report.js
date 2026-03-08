import { Router } from 'express';
import { saveReport, getReport } from '../services/storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_VERDICTS = new Set(['AI-Native', 'AI-Assisted', 'Traditional']);

function validateResult(result) {
  if (typeof result.repo_url !== 'string') return 'result.repo_url must be a string';
  try {
    const u = new URL(result.repo_url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:')
      return 'result.repo_url must use http or https scheme';
    if (u.hostname !== 'github.com') return 'result.repo_url must be a github.com URL';
  } catch {
    return 'result.repo_url must be a valid URL';
  }
  if (typeof result.repo_name !== 'string') return 'result.repo_name must be a string';
  if (typeof result.score !== 'number') return 'result.score must be a number';
  if (!VALID_VERDICTS.has(result.verdict))
    return `result.verdict must be one of: ${Array.from(VALID_VERDICTS).join(', ')}`;
  if (!Array.isArray(result.assistants)) return 'result.assistants must be an array';
  if (!Array.isArray(result.primitives)) return 'result.primitives must be an array';
  return null;
}

const router = Router();

router.post('/', (req, res) => {
  const { result } = req.body;

  if (!result || typeof result !== 'object') {
    return res.status(400).json({ error: 'result object is required' });
  }

  const validationError = validateResult(result);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const id = saveReport(result);
  const url = `/report/${id}`;

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
