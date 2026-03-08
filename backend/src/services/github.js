const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Builds GitHub API request headers.
 * @param {string} [token] - Optional GitHub API token
 * @returns {Record<string, string>}
 */
function buildHeaders(token) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'is-ai-native/1.0',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/**
 * Fetches with a timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Custom error class for GitHub API errors with additional context.
 */
export class GitHubApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status - HTTP status code
   * @param {number} [rateRemaining] - Remaining rate limit
   * @param {string} [rateReset] - Rate limit reset time
   */
  constructor(message, status, rateRemaining, rateReset) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateRemaining = rateRemaining;
    this.rateReset = rateReset;
  }
}

/**
 * Reads GitHub rate limit headers from a response.
 * @param {Response} resp
 * @returns {{ rateRemaining: number, rateReset: string | null }}
 */
function getRateLimitDetails(resp) {
  return {
    rateRemaining: parseInt(resp.headers.get('x-ratelimit-remaining') ?? '', 10),
    rateReset: resp.headers.get('x-ratelimit-reset'),
  };
}

/**
 * Determines whether a failed authenticated request should be retried without auth.
 * This protects public-repo scans from broken or over-scoped tokens.
 * @param {Response} resp
 * @returns {boolean}
 */
function shouldRetryUnauthenticated(resp) {
  const { rateRemaining } = getRateLimitDetails(resp);
  return resp.status === 401 || (resp.status === 403 && rateRemaining !== 0);
}

/**
 * Handles GitHub API error responses and throws descriptive errors.
 * @param {Response} resp - Fetch response
 * @param {string} context - Description of the request for error messages
 */
async function handleErrorResponse(resp, context) {
  const { rateRemaining, rateReset } = getRateLimitDetails(resp);
  const body = await resp.json().catch(() => ({}));

  if (resp.status === 403 && rateRemaining === 0) {
    const resetDate = rateReset ? new Date(parseInt(rateReset, 10) * 1000) : null;
    const resetMsg = resetDate ? ` — resets at ${resetDate.toISOString()}` : '';
    throw new GitHubApiError(
      `GitHub API rate limit exceeded${resetMsg}`,
      429,
      rateRemaining,
      rateReset
    );
  }

  if (resp.status === 401) {
    throw new GitHubApiError(
      body.message || 'GitHub authentication failed. The configured token may be invalid or expired.',
      401,
      rateRemaining,
      rateReset
    );
  }

  if (resp.status === 403) {
    throw new GitHubApiError(
      body.message || 'Repository is private or access is forbidden. Only public repositories are supported.',
      403,
      rateRemaining,
      rateReset
    );
  }

  if (resp.status === 404) {
    throw new GitHubApiError(
      'Repository not found. Please check the URL and make sure the repository exists.',
      404,
      rateRemaining,
      rateReset
    );
  }

  throw new GitHubApiError(
    body.message || `${context} failed with status ${resp.status}`,
    resp.status,
    rateRemaining,
    rateReset
  );
}

/**
 * Fetches GitHub JSON, retrying without auth when an optional token blocks access to a public repo.
 * @param {string} url
 * @param {string} context
 * @param {string} [token]
 * @returns {Promise<any>}
 */
async function fetchGitHubJson(url, context, token) {
  const authenticatedResponse = await fetchWithTimeout(url, { headers: buildHeaders(token) });
  if (authenticatedResponse.ok) {
    return authenticatedResponse.json();
  }

  if (token && shouldRetryUnauthenticated(authenticatedResponse)) {
    const fallbackResponse = await fetchWithTimeout(url, { headers: buildHeaders() });
    if (fallbackResponse.ok) {
      return fallbackResponse.json();
    }
    await handleErrorResponse(fallbackResponse, context);
  }

  await handleErrorResponse(authenticatedResponse, context);
}

/**
 * Fetches repository metadata and file tree from the GitHub API.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {object} [options]
 * @param {string} [options.token] - GitHub API token
 * @param {string} [options.branch] - Branch to scan (defaults to repo default branch)
 * @returns {Promise<{ paths: string[], repoData: object }>}
 */
export async function fetchRepoTree(owner, repo, { token, branch } = {}) {
  // Step 1: Fetch repo metadata (includes default branch)
  const repoData = await fetchGitHubJson(
    `${GITHUB_API}/repos/${owner}/${repo}`,
    'Fetch repository metadata',
    token
  );

  // Step 2: Use specified branch or default branch
  const targetBranch = branch || repoData.default_branch;
  const encodedBranch = encodeURIComponent(targetBranch);

  // Step 3: Fetch file tree
  const treeData = await fetchGitHubJson(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodedBranch}?recursive=1`,
    'Fetch file tree',
    token
  );

  const paths = (treeData.tree || []).map((f) => f.path);

  return { paths, repoData };
}
