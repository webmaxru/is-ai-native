import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Must be set before importing server.js (module-level if-block reads this)
const tmpDir = mkdtempSync(join(tmpdir(), 'is-ai-native-frontend-'));
const brandDir = join(tmpDir, 'assets', 'brand');
mkdirSync(brandDir, { recursive: true });
writeFileSync(
  join(tmpDir, 'index.html'),
  '<!DOCTYPE html><html><head><title>__PAGE_TITLE__</title><meta name="robots" content="__PAGE_ROBOTS__"><link rel="canonical" href="__PAGE_CANONICAL__"></head><body>frontend</body></html>'
);
writeFileSync(join(brandDir, 'favicon.ico'), 'placeholder-icon');
writeFileSync(join(brandDir, 'social-card.png'), 'placeholder-social-card');
writeFileSync(join(brandDir, 'social-card.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
writeFileSync(join(brandDir, 'pinned-tab.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
writeFileSync(join(brandDir, 'logo-square.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');

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
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
    expect(res.text).toContain('frontend');
    expect(res.text).toContain('<title>Is AI Native | Audit GitHub Repositories for AI Coding Readiness</title>');
    expect(res.text).toContain('content="noindex, nofollow, noarchive"');
  });

  it('does not rate limit repeated frontend GET requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 110 }, () => request(app).get('/'))
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
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
      id: '/',
      start_url: '/',
    });
    expect(res.body.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/maskable-icon-512x512.png',
          purpose: 'maskable',
        }),
      ])
    );
  });

  it('GET /favicon.ico serves the generated asset directly', async () => {
    const res = await request(app).get('/favicon.ico');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('GET /social-card.svg serves the generated asset directly', async () => {
    const res = await request(app).get('/social-card.svg');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
  });

  it('GET /social-card.png serves the generated raster asset directly', async () => {
    const res = await request(app).get('/social-card.png');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('GET /assets/brand/logo-square.svg serves static graphic assets with cross-origin CORP', async () => {
    const res = await request(app).get('/assets/brand/logo-square.svg');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('GET /mask-icon.svg serves the generated pinned-tab asset directly', async () => {
    const res = await request(app).get('/mask-icon.svg');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
  });

  it('GET /android-chrome-192x192.png returns 404 instead of 500 when the branded asset is absent', async () => {
    const res = await request(app).get('/android-chrome-192x192.png');

    expect(res.status).toBe(404);
  });

  it('GET /manifest.webmanifest redirects to the canonical manifest route', async () => {
    const res = await request(app).get('/manifest.webmanifest');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/site.webmanifest');
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
