import { jest } from '@jest/globals';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.NODE_ENV = 'test';

describe('resolveFrontendPath', () => {
  it('resolves a relative FRONTEND_PATH from the current working directory', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');

    expect(resolveFrontendPath('../frontend')).toMatch(/frontend$/);
  });

  it('falls back to the repository frontend directory when no override is provided', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');

    expect(resolveFrontendPath()).toMatch(/frontend$/);
  });

  it('finds bundled frontend assets when the backend is packaged under /app/src', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'is-ai-native-bundled-'));

    try {
      const bundledSrcDir = join(tmpRoot, 'src');
      const bundledFrontendDir = join(tmpRoot, 'frontend');

      mkdirSync(bundledSrcDir, { recursive: true });
      mkdirSync(bundledFrontendDir, { recursive: true });
      writeFileSync(join(bundledFrontendDir, 'index.html'), '<!DOCTYPE html><html></html>');

      expect(resolveFrontendPath(undefined, { cwd: tmpRoot, baseDir: bundledSrcDir })).toBe(bundledFrontendDir);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('falls back to bundled frontend assets when FRONTEND_PATH points to a missing directory', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'is-ai-native-bundled-fallback-'));

    try {
      const bundledSrcDir = join(tmpRoot, 'src');
      const bundledFrontendDir = join(tmpRoot, 'frontend');

      mkdirSync(bundledSrcDir, { recursive: true });
      mkdirSync(bundledFrontendDir, { recursive: true });
      writeFileSync(join(bundledFrontendDir, 'index.html'), '<!DOCTYPE html><html></html>');

      expect(resolveFrontendPath('missing-frontend', { cwd: tmpRoot, baseDir: bundledSrcDir })).toBe(
        bundledFrontendDir
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('returns null when neither source nor bundled frontend assets exist', async () => {
    const { resolveFrontendPath } = await import('../../src/server.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'is-ai-native-no-frontend-'));

    try {
      const emptySrcDir = join(tmpRoot, 'src');
      mkdirSync(emptySrcDir, { recursive: true });

      expect(resolveFrontendPath(undefined, { cwd: tmpRoot, baseDir: emptySrcDir })).toBeNull();
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('runtime Docker image packaging', () => {
  it('copies the generated frontend brand assets into the runtime image', () => {
    const dockerfile = readFileSync(join(process.cwd(), '..', '..', 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain('COPY webapp/frontend/assets ../frontend/assets');
  });

  it('copies the linked core workspace package to the runtime path expected by npm file dependencies', () => {
    const dockerfile = readFileSync(join(process.cwd(), '..', '..', 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain('COPY --from=deps /app/packages /packages');
    expect(dockerfile).not.toContain('COPY --from=deps /app/packages ../packages');
  });
});

describe('resolveTrustProxyValue', () => {
  it('defaults to false outside production', async () => {
    const { resolveTrustProxyValue } = await import('../../src/server.js');

    expect(resolveTrustProxyValue({ NODE_ENV: 'development' })).toBe(false);
  });

  it('defaults to a single trusted proxy in production', async () => {
    const { resolveTrustProxyValue } = await import('../../src/server.js');

    expect(resolveTrustProxyValue({ NODE_ENV: 'production' })).toBe(1);
  });

  it('honors explicit TRUST_PROXY values', async () => {
    const { resolveTrustProxyValue } = await import('../../src/server.js');

    expect(resolveTrustProxyValue({ TRUST_PROXY: 'true' })).toBe(true);
    expect(resolveTrustProxyValue({ TRUST_PROXY: '2' })).toBe(2);
    expect(resolveTrustProxyValue({ TRUST_PROXY: 'loopback' })).toBe('loopback');
  });
});

describe('resolveRateLimitPolicy', () => {
  it('falls back to defaults when values are absent or invalid', async () => {
    const { resolveRateLimitPolicy } = await import('../../src/server.js');

    expect(
      resolveRateLimitPolicy(
        { SCAN_RATE_LIMIT_WINDOW_MS: 'invalid', SCAN_RATE_LIMIT_MAX: '0' },
        {
          windowMsKey: 'SCAN_RATE_LIMIT_WINDOW_MS',
          maxKey: 'SCAN_RATE_LIMIT_MAX',
          defaultWindowMs: 1000,
          defaultMax: 25,
        }
      )
    ).toEqual({ windowMs: 1000, max: 25 });
  });

  it('uses positive integer overrides when provided', async () => {
    const { resolveRateLimitPolicy } = await import('../../src/server.js');

    expect(
      resolveRateLimitPolicy(
        { REPORT_RATE_LIMIT_WINDOW_MS: '60000', REPORT_RATE_LIMIT_MAX: '12' },
        {
          windowMsKey: 'REPORT_RATE_LIMIT_WINDOW_MS',
          maxKey: 'REPORT_RATE_LIMIT_MAX',
          defaultWindowMs: 1000,
          defaultMax: 25,
        }
      )
    ).toEqual({ windowMs: 60000, max: 12 });
  });
});

describe('createApp rate limiting', () => {
  const buildTestApp = async (envOverrides = {}) => {
    const [{ createApp, createRuntime }, supertest] = await Promise.all([
      import('../../src/server.js'),
      import('supertest'),
    ]);

    const runtime = createRuntime({
      env: {
        ...process.env,
        NODE_ENV: 'test',
        REPORTS_DIR: ':memory:',
        ENABLE_SHARING: 'true',
        ...envOverrides,
      },
    });

    return supertest.default(createApp(runtime));
  };

  it('uses separate limiter buckets for scan and report APIs', async () => {
    const request = await buildTestApp({
      SCAN_RATE_LIMIT_MAX: '2',
      REPORT_RATE_LIMIT_MAX: '1',
    });

    const scanResponses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      scanResponses.push(await request.post('/api/scan').send({}));
    }

    const reportResponses = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      reportResponses.push(await request.post('/api/report').send({}));
    }

    expect(scanResponses[0].status).toBe(400);
    expect(scanResponses[1].status).toBe(400);
    expect(scanResponses[2].status).toBe(429);
    expect(reportResponses[0].status).toBe(400);
    expect(reportResponses[1].status).toBe(429);
  });

  it('does not rate limit safe report GET requests', async () => {
    const request = await buildTestApp({
      REPORT_RATE_LIMIT_MAX: '1',
    });

    const responses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      responses.push(await request.get('/api/report/not-a-uuid'));
    }

    expect(responses.every((response) => response.status === 400)).toBe(true);
  });
});

describe('createCleanupScheduler', () => {
  it('does not start overlapping cleanup runs', async () => {
    const { createCleanupScheduler } = await import('../../src/server.js');
    const logger = { warn: jest.fn() };
    let resolveCleanup;
    const cleanup = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveCleanup = resolve;
        })
    );

    const scheduler = createCleanupScheduler({ cleanup, intervalMs: 60_000, logger });

    try {
      const firstRun = scheduler.runCleanup();
      const secondRun = scheduler.runCleanup();
      await Promise.resolve();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(secondRun).toBe(firstRun);
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping expired report cleanup because a previous run is still in progress'
      );

      resolveCleanup();
      await firstRun;
    } finally {
      clearInterval(scheduler.interval);
    }
  });

  it('swallows cleanup errors so the scheduler cannot crash the process', async () => {
    const { createCleanupScheduler } = await import('../../src/server.js');
    const logger = { warn: jest.fn() };
    const scheduler = createCleanupScheduler({
      cleanup: jest.fn().mockRejectedValue(new Error('share unavailable')),
      intervalMs: 60_000,
      logger,
    });

    try {
      await expect(scheduler.runCleanup()).resolves.toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Expired report cleanup failed: share unavailable');
    } finally {
      clearInterval(scheduler.interval);
    }
  });
});