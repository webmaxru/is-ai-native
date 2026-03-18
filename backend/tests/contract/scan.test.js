import { jest } from '@jest/globals';

process.env.NODE_ENV = 'test';

let request;
let app;
const originalFetch = global.fetch;

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

beforeAll(async () => {
  const [supertest, serverModule] = await Promise.all([
    import('supertest'),
    import('../../src/server.js'),
  ]);
  request = supertest.default;
  app = serverModule.default;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('POST /api/scan', () => {
  it('returns an orchestrator-backed scan response with branch and path metadata', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ default_branch: 'main', description: 'Repo', stargazers_count: 9 }, 200)
      )
      .mockResolvedValueOnce(
        jsonResponse({ tree: [{ path: '.github/copilot-instructions.md' }] }, 200)
      );

    const response = await request(app)
      .post('/api/scan')
      .send({ repo_url: 'microsoft/vscode', branch: 'release/1.0' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'github',
      repo_url: 'https://github.com/microsoft/vscode',
      repo_name: 'microsoft/vscode',
      branch: 'release/1.0',
      paths_scanned: 1,
      verdict: expect.any(String),
    });
    expect(response.body.score).toBeGreaterThan(0);
  });

  it('returns 400 when repo_url is missing', async () => {
    const response = await request(app).post('/api/scan').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'repo_url is required' });
  });

  it('still rate limits repeated scan submissions', async () => {
    const responses = [];

    for (let attempt = 0; attempt < 101; attempt += 1) {
      responses.push(await request(app).post('/api/scan').send({}));
    }

    expect(responses[0]?.status).toBe(400);
    expect(responses.some((response) => response.status === 429)).toBe(true);
    expect(responses.at(-1)?.status).toBe(429);
    expect(responses.at(-1)?.text).toContain('Too many requests');
  });
});