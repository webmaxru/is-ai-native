import test from 'node:test';
import assert from 'node:assert/strict';

// Set up minimal browser globals before importing the module under test.
// telemetry.js accesses document.title, window.location, window.crypto,
// window.localStorage, window.sessionStorage, navigator.sendBeacon and fetch
// at call-time (not at import-time), so we can swap them per-test.

globalThis.document = { title: 'Test app' };
globalThis.window = {
  location: { pathname: '/', href: 'http://localhost/' },
  crypto: { randomUUID: () => 'test-uuid-1234' },
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  writable: true,
  value: {},
});
globalThis.fetch = async () => new Response('', { status: 200 });

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
}

function makeBrokenStorage() {
  return {
    getItem() {
      throw new Error('storage unavailable');
    },
    setItem() {
      throw new Error('storage unavailable');
    },
    removeItem() {
      throw new Error('storage unavailable');
    },
  };
}

const VALID_CONNECTION_STRING =
  'InstrumentationKey=00000000-0000-0000-0000-000000000001;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/';

const { initTelemetry, trackUiEvent, trackPageView, disableTelemetry, clearTelemetryIdentity } =
  await import('../../src/telemetry.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function withFetch(impl, fn) {
  const prev = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return fn();
  } finally {
    globalThis.fetch = prev;
  }
}

function withBeacon(impl, fn) {
  const prev = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { sendBeacon: impl },
  });
  try {
    return fn();
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: prev,
    });
  }
}

// ── Tests: un-initialised telemetry (default state) ────────────────────────

test('trackUiEvent is a no-op and does not throw when telemetry is not initialised', async () => {
  disableTelemetry(); // ensure clean state
  await assert.doesNotReject(async () => {
    const result = await trackUiEvent('some_event', { key: 'value' });
    assert.equal(result, undefined);
  });
});

test('trackPageView is a no-op and does not throw when telemetry is not initialised', async () => {
  disableTelemetry();
  await assert.doesNotReject(async () => {
    const result = await trackPageView('My Page', { path: '/' });
    assert.equal(result, undefined);
  });
});

// ── Tests: initTelemetry with broken / missing connection strings ──────────

test('initTelemetry returns false when config has no connection string', () => {
  disableTelemetry();
  assert.equal(initTelemetry({}), false);
  assert.equal(initTelemetry({ appInsightsConnectionString: null }), false);
  assert.equal(initTelemetry({ appInsightsConnectionString: '' }), false);
});

test('initTelemetry returns false when InstrumentationKey is missing from connection string', () => {
  disableTelemetry();
  assert.equal(initTelemetry({ appInsightsConnectionString: 'IngestionEndpoint=https://example.com/' }), false);
});

test('trackUiEvent remains a no-op after initTelemetry with an invalid connection string', async () => {
  disableTelemetry();
  initTelemetry({ appInsightsConnectionString: 'not-a-valid-string' });
  await assert.doesNotReject(() => trackUiEvent('probe_event'));
});

// ── Tests: network-level failures with a valid connection string ────────────

test('trackUiEvent does not throw when fetch rejects (ad-tracker block)', async () => {
  disableTelemetry();
  initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING });
  await assert.doesNotReject(
    withFetch(
      async () => {
        throw new TypeError('Failed to fetch');
      },
      () => trackUiEvent('blocked_event', { source: 'test' })
    )
  );
  disableTelemetry();
});

test('trackUiEvent does not throw when sendBeacon throws', async () => {
  disableTelemetry();
  initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING });

  let fetchCalled = false;
  await assert.doesNotReject(
    withBeacon(
      () => {
        throw new Error('sendBeacon blocked');
      },
      () =>
        withFetch(async () => {
          fetchCalled = true;
        }, () => trackUiEvent('beacon_error_event'))
    )
  );

  assert.equal(fetchCalled, true, 'should fall back to fetch when sendBeacon throws');
  disableTelemetry();
});

test('trackUiEvent does not throw when sendBeacon is unavailable and fetch also rejects', async () => {
  disableTelemetry();

  // no sendBeacon on navigator
  const prevNav = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {},
  });

  initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING });
  await assert.doesNotReject(
    withFetch(
      async () => {
        throw new TypeError('Network request failed');
      },
      () => trackUiEvent('no_beacon_no_fetch_event')
    )
  );

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: prevNav,
  });
  disableTelemetry();
});

test('sendBeacon returning false falls through to fetch without throwing', async () => {
  disableTelemetry();
  initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING });

  let fetchCalled = false;
  await assert.doesNotReject(
    withBeacon(
      () => false, // beacon queuing failed
      () =>
        withFetch(async () => {
          fetchCalled = true;
        }, () => trackUiEvent('beacon_false_event'))
    )
  );

  assert.equal(fetchCalled, true, 'should fall back to fetch when sendBeacon returns false');
  disableTelemetry();
});

// ── Tests: broken localStorage / sessionStorage ─────────────────────────────

test('initTelemetry succeeds when localStorage is unavailable', () => {
  disableTelemetry();
  const prevStorage = globalThis.window.localStorage;
  globalThis.window.localStorage = makeBrokenStorage();

  assert.doesNotThrow(() => initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING }));

  globalThis.window.localStorage = prevStorage;
  disableTelemetry();
});

test('initTelemetry succeeds when sessionStorage is unavailable', () => {
  disableTelemetry();
  const prevStorage = globalThis.window.sessionStorage;
  globalThis.window.sessionStorage = makeBrokenStorage();

  assert.doesNotThrow(() => initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING }));

  globalThis.window.sessionStorage = prevStorage;
  disableTelemetry();
});

test('clearTelemetryIdentity does not throw when storage is unavailable', () => {
  const prevLocal = globalThis.window.localStorage;
  const prevSession = globalThis.window.sessionStorage;
  globalThis.window.localStorage = makeBrokenStorage();
  globalThis.window.sessionStorage = makeBrokenStorage();

  assert.doesNotThrow(() => clearTelemetryIdentity());

  globalThis.window.localStorage = prevLocal;
  globalThis.window.sessionStorage = prevSession;
});

// ── Tests: disableTelemetry resets state ────────────────────────────────────

test('trackUiEvent becomes a no-op after disableTelemetry is called', async () => {
  disableTelemetry();
  assert.equal(initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING }), true);

  let fetchCalled = false;
  disableTelemetry();

  await assert.doesNotReject(
    withFetch(async () => {
      fetchCalled = true;
    }, () => trackUiEvent('post_disable_event'))
  );

  assert.equal(fetchCalled, false, 'fetch must not be called after disableTelemetry');
});
