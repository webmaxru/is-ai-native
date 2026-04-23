# Project Context

- **Owner:** Maxim
- **Project:** Is it AI-Native? — Multi-surface scanner for AI-native development primitives in GitHub repos
- **Stack:** Node.js 24+ (ESM), Express backend, vanilla JS SPA frontend, Bicep IaC, Azure Container Apps, GitHub Actions CI/CD, Application Insights telemetry
- **Frontend:** `webapp/frontend/` — vanilla JS SPA, no framework, no build step. Key files: `app.js`, `api.js`, `webmcp.js`, `engagement-telemetry.js`, `telemetry.js`, `main.css`
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- 2026-04-24: Confetti celebration shipped. `webapp/frontend/src/confetti.js` is a self-contained vanilla canvas module (~135 LOC, no deps), reads brand colors at runtime via `getComputedStyle` on `--green/--amber/--red/--topbar-accent/--topbar-link` so it tracks theme changes. Triggered from `report.js` at the bottom of `renderReport()` when `displayedScore >= 80`, gated by non-enumerable `__confettiFired` flag on the result object to prevent replay on re-render.
- Z-index ladder is now documented at the top of `main.css`: 20 popovers / 30 sticky / 50 confetti / 100 toast / 200 skip-link. Use this when adding new overlays instead of inventing values.
- Pattern for one-shot decorative animations: append fixed-position canvas with `aria-hidden="true"` + `pointer-events:none`, store rAF id on the canvas DOM node so a re-fire can `cancelAnimationFrame` and remove cleanly. Self-removes when animation duration elapses.

- 2026-04-24: Made fireConfetti() defensively no-op when DOM/window unavailable (typeof checks for document, document.createElement, window, window.matchMedia). Bails silently without telemetry  unsupported environment, not a user opt-out. Fixed report.test.js #28 which renders score>=80 without full DOM.
