import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubApiError, fetchRepoTree } from '../src/index.js';

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

test('core github client retries unauthenticated for public repos when token fails', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    const callIndex = global.fetch.calls.push(args) - 1;
    const responses = [
      jsonResponse(
        { message: 'Resource not accessible by personal access token' },
        403,
        { 'x-ratelimit-remaining': '4999' }
      ),
      jsonResponse({ default_branch: 'main', description: 'public repo', stargazers_count: 42 }, 200),
      jsonResponse(
        { message: 'Resource not accessible by personal access token' },
        403,
        { 'x-ratelimit-remaining': '4998' }
      ),
      jsonResponse({ tree: [{ path: 'README.md' }] }, 200),
    ];
    return responses[callIndex];
  };
  global.fetch.calls = [];

  try {
    const result = await fetchRepoTree('microsoft', 'skills', { token: 'bad-token' });
    assert.equal(result.repoData.default_branch, 'main');
    assert.deepEqual(result.paths, ['README.md']);
    assert.equal(global.fetch.calls.length, 4);
  } finally {
    global.fetch = originalFetch;
  }
});

test('core github client surfaces rate limits as GitHubApiError', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    jsonResponse(
      { message: 'API rate limit exceeded' },
      403,
      {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1767225600',
      }
    );

  try {
    await assert.rejects(() => fetchRepoTree('microsoft', 'skills', { token: 'token' }), (error) => {
      assert.equal(error instanceof GitHubApiError, true);
      assert.equal(error.status, 429);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('core github client returns an ambiguous 404 message for missing or inaccessible repositories', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    jsonResponse(
      { message: 'Not Found' },
      404,
      {
        'x-ratelimit-remaining': '60',
      }
    );

  try {
    await assert.rejects(() => fetchRepoTree('owner', 'repo'), (error) => {
      assert.equal(error instanceof GitHubApiError, true);
      assert.equal(error.status, 404);
      assert.equal(
        error.message,
        'Repository was not found or is not accessible with the current GitHub credentials. Check the URL, or try a local or authenticated scan.'
      );
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});