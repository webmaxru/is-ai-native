# Project Guidelines

## Overview

AI-Native Development Readiness Checker — a web app that scans public GitHub repos for AI-native development primitives (instruction files, prompts, agents, skills, MCP configs) and generates a scored readiness report per assistant (Copilot, Claude Code, OpenAI Codex).

## Architecture

Monorepo with two packages: `backend/` (Express API) and `frontend/` (vanilla JS SPA served by Vite/Nginx).

- **Backend**: Express 4 on Node.js ≥20, ESM (`"type": "module"`). Single endpoint `POST /api/scan` — stateless, no database.
  - `src/routes/scan.js` — route handler, orchestrates the scan pipeline
  - `src/services/github.js` — GitHub REST API client with `fetch` + `AbortController` (10s timeout)
  - `src/services/scanner.js` — glob pattern matching via `minimatch` against the repo file tree
  - `src/services/scorer.js` — category-based and per-assistant score calculation
  - `src/services/config-loader.js` — loads and validates `src/config/primitives.json` and `assistants.json` at startup
  - `src/middleware/error-handler.js` — centralized error handler; custom errors carry `.statusCode`
- **Frontend**: No framework, no runtime deps. Pure HTML/CSS/JS with Vite as build tool. DOM-based rendering, WCAG accessible markup.

## Code Style

- ESLint flat config (`eslint.config.js`) + Prettier in both packages
- `prefer-const`, `no-var`, `eqeqeq: 'always'`, `curly: 'all'`
- Prefix unused args with `_` (e.g., `_req`, `_next`)
- `no-console: 'off'` — console logging is allowed

## Build and Test

```bash
# Backend
cd backend
npm ci
npm test              # all tests (vitest)
npm run test:unit     # unit tests only
npm run test:contract # API schema contract tests
npm run test:integration
npm run test:coverage
npm run lint
npm run dev           # node --watch

# Frontend
cd frontend
npm ci
npm run dev           # vite dev server (proxies /api → localhost:3000)
npm run build         # production build to dist/

# Docker (full stack)
docker compose up --build  # backend:3000, frontend:8080
```

## Project Conventions

- **Error pattern**: throw `new Error(msg)` with `.statusCode` property set (e.g., 400, 403, 404). The centralized error handler maps these to JSON responses. See [backend/src/services/github.js](backend/src/services/github.js) for examples.
- **Config-driven detection**: all primitive definitions live in [backend/src/config/primitives.json](backend/src/config/primitives.json) and [backend/src/config/assistants.json](backend/src/config/assistants.json). Add new detection patterns there, not in code.
- **Test structure**: `tests/unit/` (pure function tests), `tests/contract/` (API response shape), `tests/integration/` (end-to-end API behavior), `tests/performance/` (standalone benchmark script). Tests use `vi.mock()` for I/O boundaries.
- **Export pattern**: `server.js` exports both `app` (for testing with Supertest) and `startServer()`. Server auto-starts only when run as main module.
- **Frontend XSS protection**: use `escapeHtml()` from `report.js` for all user-provided content rendered to DOM.

## Integration Points

- **GitHub REST API**: Git Trees endpoint for file listing; optional `GITHUB_TOKEN` env var for higher rate limits. Rate limit (60 req/min/IP) enforced via `express-rate-limit`.
- **Docker networking**: Nginx proxies `/api/` to `http://backend:3000` with 30s read timeout. Backend healthcheck at `GET /health`.

## Security

- `helmet()` middleware for security headers
- Non-root `node` user in Docker
- Never expose raw errors or tokens in API responses
- `express.json({ limit: '1mb' })` to prevent payload abuse
