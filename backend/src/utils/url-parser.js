/**
 * Parses and validates a GitHub repository URL.
 * Accepts full URLs (https://github.com/owner/repo) and short form (owner/repo).
 * Strips trailing slashes and .git suffix.
 *
 * @param {string} input - Raw user input (URL or owner/repo)
 * @returns {{ owner: string, repo: string, url: string }} Parsed repository info
 * @throws {Error} If the input is not a valid GitHub repository reference
 */
export function parseRepoUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Repository URL is required');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Repository URL is required');
  }

  // Support short form: owner/repo
  const fullUrl = trimmed.startsWith('http') ? trimmed : `https://github.com/${trimmed}`;

  let parsed;
  try {
    parsed = new URL(fullUrl);
  } catch {
    throw new Error('Invalid repository URL format');
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error('Only github.com repositories are supported');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http/https URLs are supported');
  }

  const match = parsed.pathname.match(/^\/([^/]+)\/([^/\s.]+)/);
  if (!match) {
    throw new Error('Invalid GitHub repository URL — expected github.com/owner/repo');
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}
