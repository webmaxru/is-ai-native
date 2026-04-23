# Project Context

- **Owner:** Maxim
- **Project:** Is it AI-Native? — Multi-surface scanner for AI-native development primitives in GitHub repos
- **Stack:** Node.js 24+ (ESM), Express backend, vanilla JS SPA frontend, Bicep IaC, Azure Container Apps, GitHub Actions CI/CD, Application Insights telemetry
- **Test commands:** `npm run test:backend`, `npm run test:frontend`, `npm run test:core`, `npm run test:cli`, `npm run test:gh-extension`, `npm run test:vscode-extension`
- **Test runner:** Node.js built-in (`node --test`)
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-24: Frontend tests cannot mock ESM modules — use behavioral spies

- `npm run test:frontend` runs plain `node --test webapp/frontend/tests/unit/*.test.js` with no flags.
- Node's `mock.module()` requires `--experimental-test-module-mocks`, which the project does NOT pass. ESM exported bindings are immutable from outside, so monkey-patching after import doesn't work either.
- For integration tests that need to verify a downstream module was called (e.g., `report.js` → `confetti.js`), use **behavioral spies**: stub the lowest-level browser APIs the downstream module touches (e.g., `document.createElement('canvas')`) and count side effects. This tests end-to-end behavior, which is more valuable than a strict module spy.
- Telemetry observation pattern: `initTelemetry()` with a real-looking connection string + intercepted `globalThis.fetch` captures envelopes. trackUiEvent is a no-op until initialized.
- Browser-stub setup must happen at module top BEFORE `await import('../../src/...')` because the modules access `window`/`document` at import time (e.g., to wire event listeners).

## 2026-04-24  Confetti test browser stubs
- DOM stubs for confetti needed: `getElementById` on document (search `body.children` by id), `getComputedStyle` on window (returns `{ getPropertyValue: () => '' }`), and a `style` object that parses `cssText` into both kebab-case and camelCase keys so assertions on `style.pointerEvents` work after `style.cssText = '...'`.
- Telemetry transport in `telemetry.js` prefers `navigator.sendBeacon` over `fetch`  stub `sendBeacon` (and `Blob` to expose `_text`) so envelopes are captured **synchronously**; otherwise the async fetch fallback misses sync test assertions made right after `fireConfetti()`.
- `flushRaf` must drive a **virtual clock** (advance ~16ms per call) when the animation under test gates on `performance.now()` elapsed  real `performance.now()` barely advances during sync iteration and the animation never reaches its DURATION_MS termination.
