/**
 * Backend API client module.
 * Handles communication with the backend scan API.
 * @module api
 */

const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * @typedef {Object} ScanResponse
 * @property {string} repoUrl - The scanned repository URL
 * @property {string} timestamp - ISO timestamp of the scan
 * @property {number} overallScore - Overall readiness score (0-100)
 * @property {Object} perAssistant - Per-assistant score breakdown
 * @property {Array} primitives - Per-primitive detection results
 */

/**
 * @typedef {Object} ApiError
 * @property {string} error - Error message
 * @property {number} [rateLimitRemaining] - Remaining rate limit
 * @property {string} [retryAfter] - ISO timestamp for rate limit reset
 */

/**
 * Sends a scan request to the backend API.
 * @param {string} url - GitHub repository URL to scan
 * @param {string} [branch] - Optional branch name
 * @returns {Promise<ScanResponse>} Scan results
 * @throws {Error} On network error, timeout, or API error
 */
export async function scanRepository(url, branch) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = { url };
    if (branch) {
      body.branch = branch;
    }

    const response = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'An unexpected error occurred');
      error.statusCode = response.status;
      if (data.rateLimitRemaining !== undefined) {
        error.rateLimitRemaining = data.rateLimitRemaining;
      }
      if (data.retryAfter) {
        error.retryAfter = data.retryAfter;
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The scan is taking too long — please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
