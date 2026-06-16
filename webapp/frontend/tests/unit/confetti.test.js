import test from 'node:test';
import assert from 'node:assert/strict';

// ── Browser stubs ───────────────────────────────────────────────────────────
//
// confetti.js uses: window.matchMedia, document.createElement('canvas'),
// document.body.appendChild/removeChild, requestAnimationFrame,
// cancelAnimationFrame, and trackUiEvent from ./telemetry.js.
//
// telemetry.js's trackUiEvent is a no-op when settings is null (no
// initTelemetry() call), so we observe telemetry by intercepting
// globalThis.fetch — but with no settings, no envelope is sent at all.
// Instead, we directly verify behavior via DOM side-effects and rAF calls,
// and we reach into the telemetry module's recorded outbound calls by
// installing a fetch spy AFTER initTelemetry. To keep this simple and
// dependency-free, we install a recording shim around trackUiEvent by
// intercepting via initTelemetry + a spy fetch. See `withTelemetrySpy`.

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
}

function makeMatchMedia(reduced) {
  return (query) => ({
    media: query,
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}

function makeBodyStub() {
  const children = [];
  return {
    children,
    appendChild(node) {
      children.push(node);
      node.parentNode = this;
      return node;
    },
    removeChild(node) {
      const idx = children.indexOf(node);
      if (idx >= 0) {
        children.splice(idx, 1);
        node.parentNode = null;
      }
      return node;
    },
    contains(node) {
      return children.includes(node);
    },
  };
}

function makeCanvas() {
  const attrs = new Map();
  const style = {};
  let cssText = '';
  Object.defineProperty(style, 'cssText', {
    configurable: true,
    enumerable: true,
    get() {
      return cssText;
    },
    set(value) {
      cssText = String(value);
      for (const decl of cssText.split(';')) {
        const idx = decl.indexOf(':');
        if (idx < 0) continue;
        const key = decl.slice(0, idx).trim();
        const val = decl.slice(idx + 1).trim();
        if (!key) continue;
        style[key] = val;
        const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        style[camel] = val;
      }
    },
  });
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillRect() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    closePath() {},
  };
  return {
    nodeName: 'CANVAS',
    tagName: 'CANVAS',
    style,
    width: 0,
    height: 0,
    parentNode: null,
    setAttribute(k, v) {
      attrs.set(k, String(v));
    },
    getAttribute(k) {
      return attrs.has(k) ? attrs.get(k) : null;
    },
    hasAttribute(k) {
      return attrs.has(k);
    },
    getContext(kind) {
      return kind === '2d' ? ctx : null;
    },
    remove() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    },
  };
}

/**
 * Install browser globals. Returns handles for assertions and a `restore` fn.
 * `reduced` controls whether prefers-reduced-motion matches.
 * `runRaf` controls whether scheduled rAF callbacks are flushed.
 */
function installBrowserStubs({ reduced = false } = {}) {
  const body = makeBodyStub();
  const created = [];
  const rafCallbacks = [];
  let rafId = 0;

  globalThis.window = {
    matchMedia: makeMatchMedia(reduced),
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
    location: { pathname: '/', href: 'http://localhost/' },
    crypto: { randomUUID: () => 'test-uuid-confetti' },
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    getComputedStyle() {
      return { getPropertyValue: () => '' };
    },
    requestAnimationFrame(cb) {
      rafId += 1;
      rafCallbacks.push({ id: rafId, cb });
      return rafId;
    },
    cancelAnimationFrame(id) {
      const idx = rafCallbacks.findIndex((entry) => entry.id === id);
      if (idx >= 0) rafCallbacks.splice(idx, 1);
    },
  };

  globalThis.document = {
    title: 'Confetti test',
    body,
    documentElement: { clientWidth: 1024, clientHeight: 768 },
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') {
        const c = makeCanvas();
        created.push(c);
        return c;
      }
      return { tagName: String(tag).toUpperCase(), style: {}, setAttribute() {}, appendChild() {} };
    },
    getElementById(id) {
      return body.children.find((node) => node && node.id === id) || null;
    },
    addEventListener() {},
    removeEventListener() {},
  };

  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame.bind(globalThis.window);
  globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame.bind(globalThis.window);

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {},
  });

  return {
    body,
    created,
    rafCallbacks,
    flushRaf(maxIterations = 5000) {
      let n = 0;
      // Use a virtual clock that advances ~16ms per frame so animations
      // driven by performance.now() actually reach their duration during
      // synchronous iteration.
      let virtualTime = performance.now();
      while (rafCallbacks.length > 0 && n < maxIterations) {
        const { cb } = rafCallbacks.shift();
        virtualTime += 16;
        try {
          cb(virtualTime);
        } catch {
          // ignore — assertion failures will surface elsewhere
        }
        n += 1;
      }
      return n;
    },
  };
}

// Telemetry observation: initialize telemetry with a real-looking connection
// string and intercept fetch to capture envelopes. trackUiEvent posts JSON to
// the ingestion endpoint via fetch.
const VALID_CONNECTION_STRING =
  'InstrumentationKey=00000000-0000-0000-0000-000000000099;IngestionEndpoint=https://example-test.in.applicationinsights.azure.com/';

function captureTelemetry() {
  const captured = [];

  function ingestPayload(body) {
    if (!body) return;
    // Telemetry sends either a JSON array (sendBeacon path) or one or more
    // newline-separated JSON envelopes (fetch path). Try array first.
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        for (const env of parsed) captured.push(env);
        return;
      }
      captured.push(parsed);
      return;
    } catch {
      // Fall through to line-by-line.
    }
    for (const line of body.split('\n')) {
      if (!line.trim()) continue;
      try {
        captured.push(JSON.parse(line));
      } catch {
        // ignore parse failures
      }
    }
  }

  // Stub Blob so sendBeacon can read the payload synchronously.
  globalThis.Blob = class {
    constructor(parts = []) {
      this._text = parts.map((p) => (typeof p === 'string' ? p : '')).join('');
    }
  };

  // sendBeacon is the preferred transport in telemetry.js. Capture its
  // payload synchronously so test assertions made right after fireConfetti()
  // see the event without needing to await microtasks.
  globalThis.navigator.sendBeacon = (_url, blob) => {
    const body = blob && typeof blob === 'object' && '_text' in blob
      ? blob._text
      : typeof blob === 'string'
        ? blob
        : '';
    ingestPayload(body);
    return true;
  };

  // Fetch fallback (kept for safety; telemetry only hits this if sendBeacon
  // returns false, which our stub never does).
  globalThis.fetch = async (_url, init = {}) => {
    try {
      const body = typeof init.body === 'string' ? init.body : '';
      ingestPayload(body);
    } catch {
      // ignore
    }
    return { ok: true, status: 200 };
  };

  return captured;
}

function eventsNamed(envelopes, eventName) {
  return envelopes
    .map((e) => e?.data?.baseData)
    .filter((bd) => bd && bd.name === eventName);
}

// Install stubs once at module top so the dynamic imports succeed.
const stubs = installBrowserStubs({ reduced: false });

// Capture telemetry envelopes globally.
const captured = captureTelemetry();

const telemetry = await import('../../src/telemetry.js');
telemetry.initTelemetry({ appInsightsConnectionString: VALID_CONNECTION_STRING });

// Drain the page-view + session-started envelopes emitted at init time so
// per-test assertions only see confetti events.
function resetCapturedTelemetry() {
  captured.length = 0;
}

const confettiModule = await import('../../src/confetti.js');
const { fireConfetti, CONFETTI_SCORE_THRESHOLD } = confettiModule;

// ── Tests ───────────────────────────────────────────────────────────────────

test('CONFETTI_SCORE_THRESHOLD is exported and equals 80', () => {
  assert.equal(CONFETTI_SCORE_THRESHOLD, 80);
});

test('fireConfetti returns early and emits skipped_reason=reduced_motion when reduced motion is on', () => {
  // Re-stub matchMedia for this test.
  globalThis.window.matchMedia = makeMatchMedia(true);
  resetCapturedTelemetry();
  const beforeChildren = stubs.body.children.length;
  const beforeCanvases = stubs.created.length;

  fireConfetti({ verdict: 'AI-Native', assistantId: 'github-copilot', score: 95 });

  assert.equal(stubs.body.children.length, beforeChildren, 'no new node added to document.body');
  assert.equal(stubs.created.length, beforeCanvases, 'no canvas created');

  const events = eventsNamed(captured, 'confetti_fired_client');
  assert.equal(events.length, 1, 'exactly one confetti telemetry event was sent');
  assert.equal(events[0].properties.skipped_reason, 'reduced_motion');

  // Restore.
  globalThis.window.matchMedia = makeMatchMedia(false);
});

test('fireConfetti appends a canvas, schedules rAF, and removes the canvas after animation completes', () => {
  resetCapturedTelemetry();
  const beforeCanvases = stubs.created.length;
  const beforeChildren = stubs.body.children.length;

  fireConfetti({ verdict: 'AI-Native', assistantId: 'github-copilot', score: 90 });

  assert.equal(stubs.created.length, beforeCanvases + 1, 'one canvas created');
  assert.ok(stubs.body.children.length >= beforeChildren + 1, 'canvas appended to body');
  assert.ok(stubs.rafCallbacks.length >= 1, 'at least one rAF scheduled');

  // Simulate the animation running to completion. The module is responsible
  // for removing the canvas when particles fall off-screen.
  stubs.flushRaf();

  // After the animation drains, the canvas should be gone from body.
  const stillThere = stubs.body.children.some((node) => node.tagName === 'CANVAS');
  assert.equal(stillThere, false, 'canvas was removed from body when animation completed');
});

test('fireConfetti called twice in rapid succession results in only one canvas in the DOM at any time', () => {
  resetCapturedTelemetry();

  fireConfetti({ verdict: 'AI-Native', assistantId: 'a', score: 90 });
  // Do NOT flush rAF — second call happens while first is still animating.
  fireConfetti({ verdict: 'AI-Native', assistantId: 'b', score: 92 });

  const liveCanvases = stubs.body.children.filter((node) => node.tagName === 'CANVAS');
  assert.equal(liveCanvases.length, 1, 'exactly one canvas in DOM during overlapping fires');

  // Drain so we don't leak rAF callbacks across tests.
  stubs.flushRaf();
});

test('fireConfetti emits confetti_fired_client with correct verdict, assistant_id, and score when it fires', () => {
  resetCapturedTelemetry();

  fireConfetti({ verdict: 'AI-Native', assistantId: 'github-copilot', score: 95 });

  const events = eventsNamed(captured, 'confetti_fired_client');
  assert.equal(events.length, 1, 'exactly one confetti event emitted');

  const evt = events[0];
  assert.equal(evt.properties.verdict, 'AI-Native');
  assert.equal(evt.properties.assistant_id, 'github-copilot');
  assert.equal(
    evt.properties.skipped_reason,
    undefined,
    'skipped_reason should be omitted when confetti actually fires',
  );

  // The plan says `score` is a measurement (number), not a property.
  assert.equal(evt.measurements?.score, 95, 'score is recorded as a measurement');

  stubs.flushRaf();
});

test('canvas has aria-hidden="true" and pointer-events: none', () => {
  resetCapturedTelemetry();
  const beforeCanvases = stubs.created.length;

  fireConfetti({ verdict: 'AI-Native', assistantId: 'overall', score: 85 });

  const canvas = stubs.created[stubs.created.length - 1];
  assert.ok(canvas, 'canvas was created');
  assert.equal(stubs.created.length, beforeCanvases + 1, 'exactly one new canvas');

  assert.equal(canvas.getAttribute('aria-hidden'), 'true', 'aria-hidden="true"');

  const pe = canvas.style.pointerEvents || canvas.style['pointer-events'];
  assert.equal(pe, 'none', 'pointer-events: none on canvas style');

  stubs.flushRaf();
});
