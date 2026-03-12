/**
 * Strict validation pattern for owner/repo format.
 * - Owner: alphanumeric or hyphens, 1-39 chars, no leading/trailing hyphen
 * - Repo: alphanumeric, hyphens, dots, underscores, 1-100 chars
 */
const SHORT_FORM_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/[a-zA-Z0-9._-]{1,100}$/;

/**
 * Parses and validates a GitHub repository URL with strict validation.
 * Accepts ONLY:
 *   - Full HTTPS/HTTP URLs: https://github.com/owner/repo or http://github.com/owner/repo
 *   - Short form: owner/repo
 * 
 * Rejects URLs with:
 *   - Query parameters (?key=value)
 *   - Fragments (#section)
 *   - Trailing paths beyond /owner/repo
 *   - Non-github.com domains
 *   - URL variables or encoded characters in the path
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

  // Validate short form: owner/repo
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    if (!SHORT_FORM_REGEX.test(trimmed)) {
      throw new Error('Invalid repository format. Expected: owner/repository (alphanumeric, hyphens, dots, underscores only)');
    }
    
    // Extract owner and repo from short form
    const [owner, repo] = trimmed.split('/');
    return {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  // Validate full URL
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error('Only github.com repositories are supported');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https protocols are supported');
  }

  // Reject URLs with query parameters or fragments
  if (parsed.search) {
    throw new Error('URL query parameters are not allowed');
  }
  if (parsed.hash) {
    throw new Error('URL fragments are not allowed');
  }

  // Parse pathname strictly: must be exactly /owner/repo or /owner/repo/ or /owner/repo.git or /owner/repo.git/
  const pathname = parsed.pathname;
  const match = pathname.match(/^\/([^/]+)\/([^/]+?)(\.git)?\/?$/);
  
  if (!match) {
    throw new Error('Invalid GitHub repository URL format. Expected: https://github.com/owner/repository');
  }

  const owner = match[1];
  const repo = match[2];

  // Validate owner and repo format
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(owner)) {
    throw new Error('Invalid owner name. Must be alphanumeric with hyphens (1-39 chars, no leading/trailing hyphens)');
  }

  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(repo)) {
    throw new Error('Invalid repository name. Must contain only alphanumeric chars, hyphens, dots, underscores (1-100 chars)');
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}
