import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Must be set before importing server.js (module-level if-block reads this)
const tmpDir = mkdtempSync(join(tmpdir(), 'is-ai-native-frontend-'));
writeFileSync(
  join(tmpDir, 'index.html'),
  '<!DOCTYPE html><html><head><title>__PAGE_TITLE__</title><meta name="robots" content="__PAGE_ROBOTS__"><link rel="canonical" href="__PAGE_CANONICAL__"></head><body>frontend</body></html>'
);

process.env.NODE_ENV = 'test';
process.env.REPORTS_DIR = ':memory:';
process.env.ENABLE_SHARING = 'false';
process.env.FRONTEND_PATH = tmpDir;
process.env.SITE_ORIGIN = 'https://example.com';
process.env.CONTAINER_STARTUP_STRATEGY = 'keep-warm';
process.env.CONTAINER_MIN_REPLICAS = '1';
process.env.PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING =
  'InstrumentationKey=test-key;IngestionEndpoint=https://eastus2-3.in.applicationinsights.azure.com/';

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

describe('frontend path configured', () => {
  it('GET / serves the frontend index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('frontend');
    expect(res.text).toContain('<title>Is AI Native | Audit GitHub Repositories for AI Coding Readiness</title>');
    expect(res.text).toContain('content="noindex, nofollow, noarchive"');
  });

  it('GET / emits a CSP that allows the configured Application Insights ingestion endpoint', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain(
      "connect-src 'self' https://eastus2-3.in.applicationinsights.azure.com"
    );
  });

  it('GET /_/report/<uuid> (SPA route) serves the frontend index.html', async () => {
    const res = await request(app).get('/_/report/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('frontend');
    expect(res.text).toContain('<title>Shared report | IsAINative</title>');
    expect(res.text).toContain('content="noindex, nofollow, noarchive"');
  });

  it('GET /robots.txt serves crawl directives', async () => {
    const res = await request(app).get('/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('Disallow: /');
  });

  it('GET /site.webmanifest serves web app metadata', async () => {
    const res = await request(app).get('/site.webmanifest');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/manifest\+json/);
    expect(res.body).toMatchObject({
      name: 'IsAINative',
      short_name: 'IsAINative',
      start_url: '/',
    });
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
    expect(res.body).toMatchObject({
      status: 'ok',
      containerStartupStrategy: 'keep-warm',
      containerMinReplicas: 1,
    });
  });

  it('GET /api/config returns startup strategy metadata', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      containerStartupStrategy: 'keep-warm',
      containerMinReplicas: 1,
    });
  });
});
