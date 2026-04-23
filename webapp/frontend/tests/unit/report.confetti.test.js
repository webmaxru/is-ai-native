import test from 'node:test';
import assert from 'node:assert/strict';

// Integration tests: verify renderReport() triggers confetti at the right
// times, suppresses re-fires, and uses the displayed (preferred-assistant)
// score, not the raw overall score.
//
// Per Leela's plan section 8: "mock `fireConfetti` in `report.js` tests via
// module-level spy; do NOT actually animate in jsdom." Node's ESM does not
// permit mutating exported bindings of an already-imported module, and Node's
// `mock.module()` requires --experimental-test-module-mocks (which the
// project's npm scripts do not pass). We therefore observe fireConfetti
// behaviorally end-to-end: confetti.js, when called, creates a <canvas>
// element via document.createElement('canvas') and appends it to
// document.body. Counting canvas creations is a robust proxy for "fireConfetti
// was called and proceeded past the reduced-motion guard." All animation work
// is neutralized by stubbing requestAnimationFrame to a no-op.

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
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

const reportElement = {
  _innerHTML: '',
  classList: {
    add() {},
    remove() {},
  },
  querySelector(selector) {
    if (selector === '#repo-link') {
      return { href: '' };
    }
    return null;
  },
  set innerHTML(value) {
    this._innerHTML = value;
  },
  get innerHTML() {
    return this._innerHTML;
  },
};

const elements = new Map([
  ['report', reportElement],
  ['page-heading', { textContent: '' }],
  ['topbar-scope', { textContent: '' }],
]);

const body = makeBodyStub();
const canvasesCreated = [];

globalThis.window = {
  matchMedia(query) {
    return {
      media: query,
      matches: false, // never reduced-motion in this suite
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  },
  innerWidth: 1024,
  innerHeight: 768,
  devicePixelRatio: 1,
  location: { origin: 'https://example.com', pathname: '/', search: '', href: 'http://localhost/' },
  crypto: { randomUUID: () => 'test-uuid-report-confetti' },
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  requestAnimationFrame() {
    return 1; // no-op: we do not want to animate in jsdom-less tests
  },
  cancelAnimationFrame() {},
};

globalThis.document = {
  title: 'Report confetti test',
  body,
  documentElement: { clientWidth: 1024, clientHeight: 768 },
  addEventListener() {},
  removeEventListener() {},
  getElementById(id) {
    return elements.get(id) || null;
  },
  querySelectorAll() {
    return [];
  },
  createElement(tag) {
    if (String(tag).toLowerCase() === 'canvas') {
      const c = makeCanvas();
      canvasesCreated.push(c);
      return c;
    }
    return { tagName: String(tag).toUpperCase(), style: {}, setAttribute() {}, appendChild() {} };
  },
};

globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  writable: true,
  value: {},
});

// Telemetry remains uninitialized → trackUiEvent is a no-op (no fetch calls
// out of this suite), which is fine for the integration tests below. We are
// not asserting on telemetry here; that lives in confetti.test.js.

const { renderReport } = await import('../../src/report.js');

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeResult({ overallScore, perAssistant, verdict = 'AI-Native', repoName = 'octocat/hello-world' }) {
  return {
    repo_name: repoName,
    score: overallScore,
    verdict,
    primitives: [],
    per_assistant: perAssistant,
  };
}

function singleAssistantResult(score) {
  return makeResult({
    overallScore: score,
    verdict: score >= 60 ? 'AI-Native' : score >= 30 ? 'AI-Assisted' : 'Not AI-Native',
    perAssistant: [{ name: 'GitHub Copilot', id: 'github-copilot', score, primitives: [] }],
  });
}

function countCanvasesCreatedBy(fn) {
  const before = canvasesCreated.length;
  fn();
  return canvasesCreated.length - before;
}

// Drain the body between tests so children counts don't leak.
function resetBody() {
  body.children.length = 0;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('renderReport calls fireConfetti when displayed score is 80, 95, or 100', () => {
  for (const score of [80, 95, 100]) {
    resetBody();
    const created = countCanvasesCreatedBy(() => {
      renderReport(singleAssistantResult(score));
    });
    assert.equal(created, 1, `score ${score} should fire confetti exactly once`);
  }
});

test('renderReport does NOT call fireConfetti when displayed score is 0, 30, 59, 60, or 79', () => {
  for (const score of [0, 30, 59, 60, 79]) {
    resetBody();
    const created = countCanvasesCreatedBy(() => {
      renderReport(singleAssistantResult(score));
    });
    assert.equal(created, 0, `score ${score} must NOT fire confetti`);
  }
});

test('calling renderReport twice with the same result object fires confetti only once', () => {
  resetBody();
  const result = singleAssistantResult(95);

  const firstFire = countCanvasesCreatedBy(() => renderReport(result));
  assert.equal(firstFire, 1, 'first render fires confetti');

  const secondFire = countCanvasesCreatedBy(() => renderReport(result));
  assert.equal(secondFire, 0, 'second render of same result object must be silent (replay guard)');
});

test('calling renderReport with two different result objects fires confetti twice', () => {
  resetBody();
  const r1 = singleAssistantResult(95);
  const r2 = singleAssistantResult(95);

  const firstFire = countCanvasesCreatedBy(() => renderReport(r1));
  const secondFire = countCanvasesCreatedBy(() => renderReport(r2));

  assert.equal(firstFire, 1, 'first result fires');
  assert.equal(secondFire, 1, 'second distinct result also fires');
});

test('confetti uses displayed score: preferred assistant 85 + overall 50 → fires', () => {
  resetBody();
  // Overall score is below threshold but the preferred assistant is well above.
  // displayedScore = max(per_assistant.score) = 85, so confetti fires.
  const result = makeResult({
    overallScore: 50,
    verdict: 'AI-Assisted',
    perAssistant: [
      { name: 'GitHub Copilot', id: 'github-copilot', score: 85, primitives: [] },
      { name: 'Claude Code', id: 'claude-code', score: 25, primitives: [] },
    ],
  });

  const created = countCanvasesCreatedBy(() => renderReport(result));
  assert.equal(created, 1, 'displayed (preferred) score 85 must fire confetti even when overall is 50');
});
