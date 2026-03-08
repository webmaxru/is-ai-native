import { GitHubApiError } from '../services/github.js';

/**
 * Centralized error handler middleware.
 * Maps known error types to user-friendly HTTP responses.
 * Never exposes raw errors, stack traces, or sensitive data (e.g., GitHub token).
 */
export function errorHandler(err, _req, res, _next) {
  // GitHub API errors — map to appropriate status codes
  if (err instanceof GitHubApiError) {
    const status =
      err.status === 429 ? 429 :
      err.status === 403 ? 403 :
      err.status === 404 ? 404 :
      502;

    const response = { error: err.message };

    if (err.status === 429 && err.rateReset) {
      response.retry_after = err.rateReset;
    }

    return res.status(status).json(response);
  }

  // Validation errors (thrown from url-parser, config-loader, etc.)
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({ error: err.message });
  }

  // Abort errors (request timeout)
  if (err.name === 'AbortError') {
    return res.status(504).json({ error: 'Request timed out while contacting GitHub. Please try again.' });
  }

  // Unknown errors — log and return generic message
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

/**
 * 404 handler for unknown routes.
 */
export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Not found' });
}
