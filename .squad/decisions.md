# Squad Decisions

## Active Decisions

### 2026-04-24: Confetti celebration on high AI-native scores (web app only)

**By:** Leela (Lead) — requested by Maxim
**Status:** Implemented by Fry; tested by Hermes (48/48 frontend tests pass)

**Trigger:** Fire confetti once per successful scan when `displayedScore ≥ 80` (top of AI-Native band, uses preferred-assistant score). Constant `CONFETTI_SCORE_THRESHOLD = 80` exported from `webapp/frontend/src/confetti.js`.

**Implementation:** Custom dependency-free vanilla canvas module (`webapp/frontend/src/confetti.js`, ~135 LOC). Full-viewport absolutely-positioned canvas, ~120 particles, gravity + drift, rAF loop, ~2.5s total, self-removes when done. Brand colors read at runtime via `getComputedStyle` so it tracks theme changes.

**Integration:** `webapp/frontend/src/report.js` calls `fireConfetti({verdict, assistantId, score})` at the bottom of `renderReport()` when threshold met AND non-enumerable `result.__confettiFired` flag is unset. Flag prevents replay on re-render; new scan = new result object = new celebration. Shared report loads DO fire.

**Cross-surface scope:** Web app only. CLI / VS Code extension / GitHub CLI extension intentionally unchanged — confetti is a render-layer flourish, not a logic change. Scoring contract (`displayedScore`, verdict bands) untouched.

**Accessibility (hard rules):**
- `prefers-reduced-motion` guard returns early; telemetry still fires with `skipped_reason: 'reduced_motion'`.
- Canvas has `pointer-events: none` and `aria-hidden="true"`.
- Self-cleanup of DOM node and rAF on completion or re-fire.
- DOM-availability guard at function entry (`typeof` checks for `document`, `window`, `matchMedia`) — silent no-op in non-browser environments.

**Telemetry:** New event `confetti_fired_client` (additive to existing `scan_succeeded_client`). Properties: `verdict`, `assistant_id`, `skipped_reason` (omitted on success). Measurement: `score`. Fires from inside `fireConfetti()` so skipped fires are also tracked.

**Z-index ladder** (now documented at top of `main.css`): 20 popovers / 30 sticky / 50 confetti / 100 toast / 200 skip-link. Use this when adding new overlays.

---

### 2026-04-24: Frontend integration tests use behavioral spies, not module mocking

**By:** Hermes (Tester)
**What:** `npm run test:frontend` runs `node --test` without `--experimental-test-module-mocks`, and ESM exported bindings are immutable from outside. To verify cross-module calls (e.g., `report.js → confetti.js`), stub the lowest-level browser APIs the downstream module touches (e.g., count `document.createElement('canvas')` calls) and assert side effects.
**Why:** Avoids changing test runner flags, and tests end-to-end through real module wiring — strictly stronger than a strict module spy.
**Pattern reference:** `webapp/frontend/tests/unit/report.confetti.test.js`.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
