/**
 * Scan API route handler.
 * Handles POST /api/scan requests for repository readiness analysis.
 * @module scan
 */

import { Router } from 'express';
import { isValidGitHubUrl, parseGitHubUrl } from '../utils/url-parser.js';
import { getFileTree } from '../services/github.js';
import { scanRepository } from '../services/scanner.js';
import { calculateOverallScore, calculatePerAssistantScores } from '../services/scorer.js';

export const scanRouter = Router();

/**
 * POST /api/scan
 * Scans a GitHub repository for AI-native development primitives.
 *
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 *
 * Request body:
 * - url {string} - GitHub repository URL (required)
 * - branch {string} - Branch name (optional, defaults to repo default branch)
 *
 * Response:
 * - repoUrl {string} - The scanned repository URL
 * - timestamp {string} - ISO timestamp of the scan
 * - overallScore {number} - Overall readiness score (0-100)
 * - perAssistant {Object} - Per-assistant score breakdown
 * - primitives {Array} - Per-primitive detection results
 */
scanRouter.post('/scan', async (req, res, next) => {
  try {
    const { url: rawUrl, branch } = req.body;

    // Sanitize input
    const url = typeof rawUrl === 'string' ? rawUrl.trim().slice(0, 2048) : rawUrl;

    // Validate URL
    if (!url) {
      const error = new Error('URL is required. Please provide a GitHub repository URL.');
      error.statusCode = 400;
      throw error;
    }

    if (!isValidGitHubUrl(url)) {
      const error = new Error(
        'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo',
      );
      error.statusCode = 400;
      throw error;
    }

    // Parse URL
    const { owner, repo } = parseGitHubUrl(url);

    // Fetch file tree from GitHub
    const { tree } = await getFileTree(owner, repo, branch || undefined);

    // Scan for AI-native primitives
    const primitiveResults = scanRepository(tree);

    // Calculate scores
    const overallScore = calculateOverallScore(primitiveResults);
    const perAssistant = calculatePerAssistantScores(primitiveResults);

    // Build response
    const response = {
      repoUrl: url,
      timestamp: new Date().toISOString(),
      overallScore,
      perAssistant,
      primitives: primitiveResults,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});
