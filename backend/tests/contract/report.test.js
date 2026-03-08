import { closeDb } from '../../src/services/storage.js';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
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
});

const sampleResult = {
  repo_url: 'https://github.com/owner/repo',
  repo_name: 'owner/repo',
  score: 75,
  verdict: 'AI-Native',
  scanned_at: '2026-01-01T00:00:00.000Z',
  assistants: [],
  primitives: [],
};

describe('GET /api/config', () => {
  it('returns sharingEnabled: true when ENABLE_SHARING is true', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sharingEnabled: true });
  });
});

describe('POST /api/report (sharing enabled)', () => {
  it('returns 201 with id and url when given a valid result', async () => {
    const res = await request(app).post('/api/report').send({ result: sampleResult });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('url');
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res.body.url).toContain(`/report/${res.body.id}`);
  });

  it('returns 400 when result is missing', async () => {
    const res = await request(app).post('/api/report').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when result schema is invalid', async () => {
    const res = await request(app)
      .post('/api/report')
      .send({
        result: {
          repo_url: 'javascript:alert(1)',
          repo_name: 'x',
          score: 0,
          verdict: 'AI-Native',
          assistants: [],
          primitives: [],
        },
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/report/:id (sharing enabled)', () => {
  it('returns the stored scan result for a valid id', async () => {
    const postRes = await request(app).post('/api/report').send({ result: sampleResult });
    const { id } = postRes.body;

    const getRes = await request(app).get(`/api/report/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(sampleResult);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get(
      '/api/report/00000000-0000-4000-8000-000000000001'
    );
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for an invalid UUID format', async () => {
    const res = await request(app).get('/api/report/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('/api/report when sharing disabled', () => {
  beforeEach(() => {
    process.env.ENABLE_SHARING = 'false';
  });

  afterEach(() => {
    process.env.ENABLE_SHARING = 'true';
  });

  it('POST returns 503', async () => {
    const res = await request(app).post('/api/report').send({ result: sampleResult });
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  it('GET returns 503', async () => {
    const res = await request(app).get(
      '/api/report/00000000-0000-4000-8000-000000000001'
    );
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/config returns sharingEnabled: false', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sharingEnabled: false });
  });
});
