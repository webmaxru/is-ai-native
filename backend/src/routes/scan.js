import { Router } from 'express';
import { parseRepoUrl } from '../utils/url-parser.js';
import { fetchRepoTree } from '../services/github.js';
import { scanPrimitives } from '../services/scanner.js';
import { calculateOverallScore, calculatePerAssistantScores, getVerdict } from '../services/scorer.js';
import { loadConfig } from '../services/config-loader.js';

const router = Router();

router.post('/', async (req, res, next) => {
  const { repo_url, branch } = req.body;

  if (!repo_url || typeof repo_url !== 'string') {
    return res.status(400).json({ error: 'repo_url is required' });
  }

  let parsed;
  try {
    parsed = parseRepoUrl(repo_url);
  } catch (err) {
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

    return res.json({
      repo_url: parsed.url,
      repo_name: `${parsed.owner}/${parsed.repo}`,
      description: repoData.description || null,
      stars: repoData.stargazers_count,
      score: overallScore,
      verdict,
      scanned_at: new Date().toISOString(),
      primitives: primitiveResults,
      per_assistant: perAssistant,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
