# Implementation Plan: AI-Native Development Readiness Checker

**Branch**: `001-ai-readiness-checker` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-ai-readiness-checker/spec.md`

## Summary

Build a web application that scans public GitHub repositories for AI-native development primitives (instruction files, saved prompts, custom agents, skills, MCP server configurations) and generates a detailed readiness report with scoring. The frontend is a minimal Vite + vanilla HTML/CSS/JS application. The backend is a Node.js server that uses the GitHub REST API to inspect repository file trees and matches against configurable JSON-defined detection patterns. Results are grouped by AI assistant (GitHub Copilot, Claude Code, OpenAI Codex) with overall and per-assistant scores. The architecture supports future branch selection, shareable report URLs, and GitHub label/badge generation without refactoring.

## Technical Context

**Language/Version**: JavaScript (ES2022+), Node.js 20 LTS  
**Primary Dependencies**: Vite (frontend build), Express (backend HTTP server), node-fetch or built-in fetch (GitHub API calls). Minimal library footprint — vanilla HTML/CSS/JS on the frontend.  
**Storage**: N/A — no database. All configuration via JSON files on disk. Scan results are stateless (session-only).  
**Testing**: Vitest (unit + integration tests for both frontend and backend), supertest (API contract tests)  
**Target Platform**: Linux containers (Docker), also runs locally on any OS with Node.js 20+  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**: Complete scan and return report within 15 seconds for repos with up to 10,000 files. API endpoints respond within 200ms at p95 (excluding external GitHub API latency).  
**Constraints**: Minimal dependencies, no framework lock-in on frontend, JSON-only configuration, container-ready, no persistent storage in v1  
**Scale/Scope**: Single-page application, 1 API endpoint, ~3 JSON config files, ~5 primitive categories × 3 AI assistants

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality Excellence | ✅ PASS | ESLint + Prettier configured, vanilla JS with JSDoc type annotations, small modules |
| II. Testing Standards | ✅ PASS | Vitest for unit/integration, supertest for contract tests, test independence via mocked GitHub API |
| III. User Experience Consistency | ✅ PASS | Progress indicator with stages, clear error messages, responsive design, empty/zero states handled |
| IV. Performance Requirements | ✅ PASS | 15s scan budget, progress feedback within 100ms, minimal bundle size (no framework) |
| Development Workflow | ✅ PASS | Feature branch `001-ai-readiness-checker`, conventional commits, CI pipeline planned |
| Quality Gates | ✅ PASS | Lint, type check (JSDoc), unit tests, integration tests, coverage, bundle size, a11y scan |

**Gate result: PASS** — no violations, proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-readiness-checker/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI spec)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── config/              # JSON configuration files
│   │   ├── assistants.json  # AI assistant definitions
│   │   └── primitives.json  # Primitive definitions, patterns, docs
│   ├── services/
│   │   ├── github.js        # GitHub API client (file tree fetching)
│   │   ├── scanner.js       # Pattern matching engine
│   │   └── scorer.js        # Score calculation (overall + per-assistant)
│   ├── routes/
│   │   └── scan.js          # POST /api/scan endpoint
│   ├── middleware/
│   │   └── error-handler.js # Centralized error handling
│   ├── utils/
│   │   └── url-parser.js    # GitHub URL validation & parsing
│   └── server.js            # Express app entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/
├── package.json
└── Dockerfile

frontend/
├── src/
│   ├── index.html           # Main page with input form
│   ├── styles/
│   │   └── main.css         # Responsive styles
│   ├── js/
│   │   ├── app.js           # Main application logic
│   │   ├── api.js           # Backend API client
│   │   └── report.js        # Report rendering logic
│   └── assets/              # Icons, images
├── tests/
│   └── unit/
├── vite.config.js
└── package.json

docker-compose.yml               # Local multi-container setup
```

**Structure Decision**: Web application structure with separate `backend/` and `frontend/` directories. The backend is a standalone Node.js/Express server. The frontend is a Vite-built vanilla HTML/CSS/JS SPA. Both have independent `package.json` files, test directories, and can be containerized independently. This separation enables independent scaling and deployment in the future.

## Complexity Tracking

No constitution violations — table intentionally left empty.
