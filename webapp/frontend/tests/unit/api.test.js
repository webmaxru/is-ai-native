import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchConfig, resolveApiBaseUrl, scanRepo } from '../../src/api.js';

test('resolveApiBaseUrl uses same-origin API routes when no runtime origin is configured', () => {
  assert.equal(resolveApiBaseUrl(), '/api');
  assert.equal(resolveApiBaseUrl({ apiOrigin: '' }), '/api');
});

test('resolveApiBaseUrl points static frontend requests at the ACA origin', () => {
  assert.equal(
    resolveApiBaseUrl({ apiOrigin: 'https://is-ai-native-api.example.azurecontainerapps.io' }),
    'https://is-ai-native-api.example.azurecontainerapps.io/api'
  );
});

test('resolveApiBaseUrl rejects malformed runtime configuration', () => {
  assert.throws(
    () => resolveApiBaseUrl({ apiOrigin: '/backend' }),
    /absolute HTTP\(S\) origin/
  );
  assert.throws(
    () => resolveApiBaseUrl({ apiOrigin: 'https://example.com/backend' }),
    /without a path/
  );
});

test('fetchConfig uses the configured ACA origin and disables caching', async () => {
  const previousConfig = globalThis.__IS_AI_NATIVE_CONFIG__;
  const previousFetch = globalThis.fetch;
  let request;

  globalThis.__IS_AI_NATIVE_CONFIG__ = {
    apiOrigin: 'https://backend.example.com',
  };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ sharingEnabled: true });
  };

  try {
    const config = await fetchConfig();
    assert.deepEqual(config, { sharingEnabled: true });
    assert.equal(request.url, 'https://backend.example.com/api/config');
    assert.equal(request.options.cache, 'no-store');
  } finally {
    globalThis.__IS_AI_NATIVE_CONFIG__ = previousConfig;
    globalThis.fetch = previousFetch;
  }
});

test('scanRepo preserves backend API errors', async () => {
  const previousConfig = globalThis.__IS_AI_NATIVE_CONFIG__;
  const previousFetch = globalThis.fetch;

  globalThis.__IS_AI_NATIVE_CONFIG__ = {
    apiOrigin: 'https://backend.example.com',
  };
  globalThis.fetch = async () => Response.json({ error: 'Repository is private' }, { status: 403 });

  try {
    await assert.rejects(() => scanRepo('owner/private'), /Repository is private/);
  } finally {
    globalThis.__IS_AI_NATIVE_CONFIG__ = previousConfig;
    globalThis.fetch = previousFetch;
  }
});
