import { Router } from 'express';
import { scanRepository } from '../services/scanner.js';

const router = Router();

router.post('/', async (req, res) => {
  const { repo_url } = req.body;

  if (!repo_url || typeof repo_url !== 'string') {
    return res.status(400).json({ error: 'repo_url is required' });
  }

  const url = repo_url.trim();
  if (!url.includes('github.com')) {
    return res.status(400).json({ error: 'Only GitHub repositories are supported' });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const result = await scanRepository(url, token);
    return res.json(result);
  } catch (err) {
    const message = err.message || 'Scan failed';
    if (message.includes('not found') || message.includes('404')) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    return res.status(502).json({ error: message });
  }
});

export default router;
