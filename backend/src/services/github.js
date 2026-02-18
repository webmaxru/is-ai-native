/**
 * GitHub API client service.
 * Fetches repository file tree via the GitHub REST API (Git Trees endpoint).
 * @module github
 */

/**
 * @typedef {Object} GitHubTreeEntry
 * @property {string} path - File path relative to repository root
 * @property {string} type - Entry type: 'blob' (file) or 'tree' (directory)
 * @property {string} sha - Git SHA of the entry
 * @property {number} [size] - File size in bytes (only for blobs)
 */

/**
 * @typedef {Object} GitHubFileTree
 * @property {string} sha - SHA of the tree
 * @property {GitHubTreeEntry[]} tree - Array of file tree entries
 * @property {boolean} truncated - Whether the tree was truncated (>100k entries)
 */

/**
 * @typedef {Object} GitHubRepoInfo
 * @property {string} defaultBranch - The default branch name
 * @property {string} fullName - Full repository name (owner/repo)
 */

const GITHUB_API_BASE = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 10000;

/** Maximum number of tree entries to process (prevent memory issues) */
const MAX_TREE_ENTRIES = 100_000;

/**
 * Creates HTTP headers for GitHub API requests.
 * Includes authorization header if GITHUB_TOKEN is available.
 * @returns {Record<string, string>} HTTP headers
 */
function getHeaders() {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ai-readiness-checker',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Makes an HTTP request to the GitHub API with timeout support.
 * @param {string} url - Full API URL
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: getHeaders(),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handles GitHub API error responses and throws descriptive errors.
 * @param {Response} response - Fetch response object
 * @param {string} context - Description of the operation for error messages
 * @throws {Error} With appropriate message and status code
 */
async function handleApiError(response, context) {
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimitReset = response.headers.get('x-ratelimit-reset');

  if (response.status === 403) {
    if (rateLimitRemaining === '0') {
      const resetDate = rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000) : null;
      const minutesUntilReset = resetDate
        ? Math.ceil((resetDate.getTime() - Date.now()) / 60000)
        : null;
      const error = new Error(
        `GitHub API rate limit exceeded. ${minutesUntilReset ? `Try again in ${minutesUntilReset} minutes.` : 'Try again later.'}`,
      );
      error.statusCode = 429;
      error.rateLimitRemaining = 0;
      error.rateLimitReset = resetDate;
      throw error;
    }

    const error = new Error(
      'This repository is private or access is denied. Only public repositories are supported.',
    );
    error.statusCode = 403;
    throw error;
  }

  if (response.status === 404) {
    const error = new Error(`Repository not found. Please check the URL and try again.`);
    error.statusCode = 404;
    throw error;
  }

  if (response.status === 409) {
    const error = new Error(
      'This repository appears to be empty. It has no commits or file tree.',
    );
    error.statusCode = 409;
    throw error;
  }

  if (response.status >= 500) {
    const error = new Error('GitHub is experiencing issues. Please try again later.');
    error.statusCode = 502;
    throw error;
  }

  const error = new Error(`${context}: unexpected error (status ${response.status})`);
  error.statusCode = response.status;
  throw error;
}

/**
 * Fetches repository metadata to determine default branch.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<GitHubRepoInfo>} Repository info with default branch
 */
export async function getRepoInfo(owner, repo) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      await handleApiError(response, 'Failed to fetch repository info');
    }

    const data = await response.json();
    return {
      defaultBranch: data.default_branch,
      fullName: data.full_name,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(
        'Request to GitHub timed out. The service may be slow — please try again.',
      );
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Fetches the complete file tree for a repository using the Git Trees API.
 * Uses recursive mode to get all files in a single request.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} [branch] - Branch name (defaults to repo's default branch)
 * @returns {Promise<{tree: GitHubTreeEntry[], truncated: boolean}>} File tree entries
 */
export async function getFileTree(owner, repo, branch) {
  // If no branch specified, get the default branch first
  let targetBranch = branch;
  if (!targetBranch) {
    const repoInfo = await getRepoInfo(owner, repo);
    targetBranch = repoInfo.defaultBranch;
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      await handleApiError(response, 'Failed to fetch file tree');
    }

    const data = await response.json();

    const tree = data.tree || [];
    const truncated = data.truncated || false;

    // Guard against extremely large repos consuming too much memory
    if (tree.length > MAX_TREE_ENTRIES) {
      console.warn(
        `Repository ${owner}/${repo} has ${tree.length} entries (exceeds ${MAX_TREE_ENTRIES}). Truncating.`,
      );
      return {
        tree: tree.slice(0, MAX_TREE_ENTRIES),
        truncated: true,
      };
    }

    if (truncated) {
      console.warn(
        `Repository ${owner}/${repo} file tree was truncated by GitHub API (>100k entries).`,
      );
    }

    return { tree, truncated };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(
        'Request to GitHub timed out. The repository may be very large — please try again.',
      );
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  }
}
