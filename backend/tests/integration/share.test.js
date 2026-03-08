import { closeDb } from '../../src/services/storage.js';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

let request;
let app;

beforeAll(async () => {
  const [supertest, serverModule] = await Promise.all([
    import('supertest'),
    import('../../src/server.js'),
  ]);
  request = supertest.default;
  app = serverModule.default;
});

afterEach(() => {
  closeDb();
});

describe('Integration: share → retrieve', () => {
  it('stores a result via POST and retrieves identical payload via GET', async () => {
    const scanResult = {
      repo_url: 'https://github.com/acme/demo',
      repo_name: 'acme/demo',
      score: 80,
      verdict: 'AI-Native',
      scanned_at: '2026-01-01T12:00:00.000Z',
      assistants: [
        { id: 'github-copilot', name: 'GitHub Copilot', detected: true },
        { id: 'cursor', name: 'Cursor', detected: false },
        { id: 'windsurf', name: 'Windsurf', detected: false },
      ],
      primitives: [
        { id: 'ci-pipelines', name: 'CI / CD Pipelines', detected: true },
        { id: 'dependabot', name: 'Dependabot', detected: true },
      ],
    };

    // Step 1: Share the result
    const shareRes = await request(app).post('/api/report').send({ result: scanResult });
    expect(shareRes.status).toBe(201);
    const { id, url } = shareRes.body;
    expect(id).toBeDefined();
    expect(url).toContain(id);

    // Step 2: Retrieve the result
    const getRes = await request(app).get(`/api/report/${id}`);
    expect(getRes.status).toBe(200);

    // Step 3: Verify payloads match
    expect(getRes.body).toEqual(scanResult);
  });

  it('returns 404 after report ID is exhausted (unknown id)', async () => {
    const getRes = await request(app).get(
      '/api/report/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    );
    expect(getRes.status).toBe(404);
  });
});
