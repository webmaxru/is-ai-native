import { closeDb } from '../../src/services/storage.js';

process.env.NODE_ENV = 'test';
process.env.ENABLE_SHARING = 'true';

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
  process.env.REPORTS_DIR = ':memory:';
});

beforeEach(() => {
  process.env.REPORTS_DIR = ':memory:';
});

describe('Integration: share → retrieve', () => {
  it('stores a result via POST and retrieves identical payload via GET', async () => {
    const scanResult = {
      repo_url: 'https://github.com/acme/demo',
      repo_name: 'acme/demo',
      score: 80,
      verdict: 'AI-Native',
      scanned_at: '2026-01-01T12:00:00.000Z',
      primitives: [
        { name: 'Instruction Files', category: 'instructions', detected: true, matched_files: ['.github/copilot-instructions.md'], description: 'Instruction files', doc_links: [] },
      ],
      per_assistant: [
        { id: 'github-copilot', name: 'GitHub Copilot', score: 100, primitives: [{ name: 'Instruction Files', category: 'instructions', detected: true, matched_files: ['.github/copilot-instructions.md'] }] },
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

  it('accepts a scan payload shaped like the live scan response', async () => {
    const scanResult = {
      repo_url: 'https://github.com/microsoft/skills',
      repo_name: 'microsoft/skills',
      description: null,
      stars: 1234,
      score: 100,
      verdict: 'AI-Native',
      scanned_at: '2026-03-08T21:00:00.000Z',
      primitives: [
        {
          name: 'Instruction Files',
          category: 'instructions',
          detected: true,
          matched_files: ['.github/copilot-instructions.md'],
          description: 'Instruction files',
          doc_links: ['https://docs.github.com/en/copilot'],
          assistant_results: {
            'github-copilot': {
              detected: true,
              matched_files: ['.github/copilot-instructions.md'],
            },
          },
        },
      ],
      per_assistant: [
        {
          id: 'github-copilot',
          name: 'GitHub Copilot',
          score: 100,
          primitives: [
            {
              name: 'Instruction Files',
              category: 'instructions',
              detected: true,
              matched_files: ['.github/copilot-instructions.md'],
            },
          ],
        },
      ],
    };

    const shareRes = await request(app).post('/api/report').send({ result: scanResult });
    expect(shareRes.status).toBe(201);

    const getRes = await request(app).get(`/api/report/${shareRes.body.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(scanResult);
  });
});
