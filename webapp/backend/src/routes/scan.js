import { Router } from 'express';
import { parseRepoUrl } from '../utils/url-parser.js';
import { Profiles, scanRepository } from '@is-ai-native/core';
import { trackScanCompleted, trackScanFailed } from '../services/app-insights.js';

export function createScanRouter(runtime) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    const startedAt = Date.now();
    const { repo_url, branch } = req.body;

    if (!repo_url || typeof repo_url !== 'string') {
      void trackScanFailed({
        repoUrl: typeof repo_url === 'string' ? repo_url : null,
        reason: 'repo_url is required',
        statusCode: 400,
        errorName: 'ValidationError',
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ error: 'repo_url is required' });
    }

    let parsed;
    try {
      parsed = parseRepoUrl(repo_url);
    } catch (err) {
      void trackScanFailed({
        repoUrl: repo_url,
        reason: err.message,
        statusCode: 400,
        errorName: err.name || 'ValidationError',
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ error: err.message });
    }

    try {
      const configSource = {
        loadConfig() {
          return runtime.config;
        },
      };
      const result = await scanRepository(
        Profiles.github({
          owner: parsed.owner,
          repo: parsed.repo,
          token: runtime.githubToken,
          branch: branch || undefined,
          configSource,
        })
      );

      void trackScanCompleted(result, { durationMs: Date.now() - startedAt });

      return res.json(result);
    } catch (err) {
      void trackScanFailed({
        repoUrl: parsed?.url || repo_url,
        repoName: parsed ? `${parsed.owner}/${parsed.repo}` : null,
        reason: err.message,
        statusCode: err.status || err.statusCode || 500,
        errorName: err.name || 'Error',
        durationMs: Date.now() - startedAt,
      });
      next(err);
    }
  });

  return router;
}

export default createScanRouter;
