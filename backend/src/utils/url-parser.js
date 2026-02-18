/**
 * GitHub URL parser and validator.
 * Extracts owner/repo from GitHub URLs and validates format.
 * @module url-parser
 */

/**
 * @typedef {Object} ParsedGitHubUrl
 * @property {string} owner - Repository owner (user or organization)
 * @property {string} repo - Repository name
 */

/**
 * Regular expression to match GitHub repository URLs.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/
 * - http://github.com/owner/repo
 * - github.com/owner/repo
 */
const GITHUB_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?$/;

/**
 * Validates that the given string is a GitHub repository URL.
 * @param {string} url - The URL to validate
 * @returns {boolean} True if the URL is a valid GitHub repository URL
 */
export function isValidGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return GITHUB_URL_REGEX.test(url.trim());
}

/**
 * Parses a GitHub repository URL and extracts owner and repo.
 * @param {string} url - The GitHub repository URL
 * @returns {ParsedGitHubUrl} Parsed owner and repo
 * @throws {Error} If the URL is not a valid GitHub repository URL
 */
export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const trimmed = url.trim();
  const match = trimmed.match(GITHUB_URL_REGEX);

  if (!match) {
    if (trimmed.includes('github.com')) {
      throw new Error(
        'Invalid GitHub repository URL format. Expected: https://github.com/owner/repo',
      );
    }
    throw new Error('Only GitHub repository URLs are supported (https://github.com/owner/repo)');
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}
