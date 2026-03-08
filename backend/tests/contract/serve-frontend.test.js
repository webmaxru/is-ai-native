import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Must be set before importing server.js (module-level if-block reads this)
const tmpDir = mkdtempSync(join(tmpdir(), 'is-ai-native-frontend-'));
writeFileSync(join(tmpDir, 'index.html'), '<!DOCTYPE html><html><body>frontend</body></html>');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.ENABLE_SHARING = 'false';
process.env.SERVE_FRONTEND = 'true';
process.env.FRONTEND_PATH = tmpDir;

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

afterAll(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; temp dirs are cleaned by the OS on reboot
  }
});

describe('SERVE_FRONTEND=true', () => {
  it('GET / serves the frontend index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('frontend');
  });

  it('GET /_/report/<uuid> (SPA route) serves the frontend index.html', async () => {
    const res = await request(app).get('/_/report/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('frontend');
  });

  it('GET /api/unknown still returns JSON 404 (not index.html)', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /health still returns JSON status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});
