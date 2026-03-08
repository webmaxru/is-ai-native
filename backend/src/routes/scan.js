import { Router } from 'express';
import { parseRepoUrl } from '../utils/url-parser.js';
import { fetchRepoTree } from '../services/github.js';
import { scanPrimitives } from '../services/scanner.js';
import { calculateOverallScore, calculatePerAssistantScores, getVerdict } from '../services/scorer.js';
import { loadConfig } from '../services/config-loader.js';
import { trackScanCompleted, trackScanFailed } from '../services/app-insights.js';

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
    const token = process.env.GH_TOKEN_FOR_SCAN;
    const config = loadConfig();

    const { paths, repoData } = await fetchRepoTree(parsed.owner, parsed.repo, {
      token,
      branch: branch || undefined,
    });

    const primitiveResults = scanPrimitives(paths, config.primitives);
    const overallScore = calculateOverallScore(primitiveResults);
    const perAssistant = calculatePerAssistantScores(primitiveResults, config.assistants);
    const verdict = getVerdict(overallScore);

    const result = {
      repo_url: parsed.url,
      repo_name: `${parsed.owner}/${parsed.repo}`,
      description: repoData.description || null,
      stars: repoData.stargazers_count,
      score: overallScore,
      verdict,
      scanned_at: new Date().toISOString(),
      primitives: primitiveResults,
      per_assistant: perAssistant,
    };

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

export default router;
