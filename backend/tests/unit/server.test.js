import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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