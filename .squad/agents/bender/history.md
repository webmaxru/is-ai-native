# Project Context

- **Owner:** Maxim
- **Project:** Is it AI-Native? — Multi-surface scanner for AI-native development primitives in GitHub repos
- **Stack:** Node.js 24+ (ESM), Express backend, vanilla JS SPA frontend, Bicep IaC, Azure Container Apps, GitHub Actions CI/CD, Application Insights telemetry
- **Backend:** `webapp/backend/` — Express server at port 3000. Key routes: `/api/scan`, `/api/config`, `/api/report`, `/api/health`
- **Core engine:** `packages/core/` — scanner.js, scorer.js, config-loader.js, github.js, scan-orchestrator.js
- **Extensions:** `packages/cli/`, `packages/gh-extension/`, `packages/vscode-extension/`
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
