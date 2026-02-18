/**
 * Centralized error handling middleware.
 * Handles 404, validation errors, GitHub API errors, and rate limits.
 * Never exposes raw errors or GitHub token to clients.
 * @module error-handler
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {string} error - User-friendly error message
 * @property {number} [rateLimitRemaining] - Remaining GitHub API rate limit (if applicable)
 * @property {string} [retryAfter] - ISO timestamp when rate limit resets (if applicable)
 */

/**
 * Handles 404 Not Found for unmatched routes.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} _next - Express next function
 */
export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: `Not found: ${req.method} ${req.path}`,
  });
}

/**
 * Centralized error handler middleware.
 * Maps errors to user-friendly responses without exposing internals.
 * @param {Error & {statusCode?: number, rateLimitRemaining?: number, rateLimitReset?: Date}} err - Error object
 * @param {import('express').Request} _req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} _next - Express next function
 */
export function errorHandler(err, _req, res, _next) {
  // Log the full error for debugging (server-side only)
  console.error('Error:', err.message);

  // Determine status code
  const statusCode = err.statusCode || 500;

  /** @type {ErrorResponse} */
  const response = {
    error: getClientMessage(err, statusCode),
  };

  // Add rate limit info if available
  if (err.rateLimitRemaining !== undefined) {
    response.rateLimitRemaining = err.rateLimitRemaining;
  }
  if (err.rateLimitReset) {
    response.retryAfter = err.rateLimitReset.toISOString();
  }

  res.status(statusCode).json(response);
}

/**
 * Maps an error to a user-friendly message.
 * Ensures no raw errors, stack traces, or sensitive data is leaked.
 * @param {Error & {statusCode?: number}} err - Error object
 * @param {number} statusCode - HTTP status code
 * @returns {string} User-friendly error message
 */
function getClientMessage(err, statusCode) {
  // Use the error message if it was explicitly set by our code (has statusCode)
  if (err.statusCode) {
    return err.message;
  }

  // For unexpected errors, return generic messages
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 403:
      return 'This repository is private or access is denied. Only public repositories are supported.';
    case 404:
      return 'Repository not found. Please check the URL and try again.';
    case 429:
      return 'GitHub API rate limit exceeded. Please try again later.';
    case 504:
      return 'Request timed out. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again later.';
  }
}
