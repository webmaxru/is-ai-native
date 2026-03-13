import { jest } from '@jest/globals';
import { fetchRepoTree, GitHubApiError } from '../../src/services/github.js';

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

describe('fetchRepoTree', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('retries unauthenticated when the configured token is forbidden for a public repo', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'Resource not accessible by personal access token' },
          403,
          { 'x-ratelimit-remaining': '4999' }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { default_branch: 'main', description: 'public repo', stargazers_count: 42 },
          200
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'Resource not accessible by personal access token' },
          403,
          { 'x-ratelimit-remaining': '4998' }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ tree: [{ path: 'README.md' }] }, 200));

    const result = await fetchRepoTree('microsoft', 'skills', { token: 'bad-token' });

    expect(result.repoData.default_branch).toBe('main');
    expect(result.paths).toEqual(['README.md']);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer bad-token');
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer bad-token');
    expect(global.fetch.mock.calls[3][1].headers.Authorization).toBeUndefined();
  });

  it('does not retry when GitHub rate limiting is the actual failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      jsonResponse(
        { message: 'API rate limit exceeded' },
        403,
        {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1767225600',
        }
      )
    );

    await expect(fetchRepoTree('microsoft', 'skills', { token: 'token' })).rejects.toMatchObject({
      name: 'GitHubApiError',
      status: 429,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces an authentication error when an invalid token fails and the unauthenticated fallback also fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'Bad credentials' },
          401,
          { 'x-ratelimit-remaining': '4999' }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'Repository not found' },
          404,
          { 'x-ratelimit-remaining': '60' }
        )
      );

    const result = fetchRepoTree('owner', 'missing-repo', { token: 'bad-token' });

    await expect(result).rejects.toBeInstanceOf(GitHubApiError);
    await expect(result).rejects.toMatchObject({
      status: 404,
      message: 'Repository was not found or is not accessible with the current GitHub credentials. Check the URL, or try a local or authenticated scan.',
    });
  });
});