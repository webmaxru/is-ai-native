# Deployment Requirements Quality Checklist: AI-Native Development Readiness Checker

**Purpose**: Validate completeness, clarity, and consistency of deployment and operational requirements
**Created**: 2026-02-18
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 - Are container image requirements specified (base image, multi-stage build, image size budget)? [Completeness, Gap] — **Resolved**: Node.js runtime image bundles backend and frontend assets for a single-container deployment path.
- [x] CHK002 - Are requirements defined for which ports the backend and frontend services expose? [Completeness, Gap] — **Resolved**: Single-container runtime exposes port 3000 for both SPA and API traffic.
- [x] CHK003 - Are environment variable requirements enumerated (GITHUB_TOKEN, PORT, NODE_ENV, API_URL, etc.)? [Completeness, Gap] — **Resolved**: GITHUB_TOKEN (optional), PORT (default 3000), NODE_ENV, VITE_API_URL.
- [x] CHK004 - Are requirements defined for how the frontend knows the backend API URL in different environments (local dev, container, production)? [Completeness, Gap] — **Resolved**: VITE_API_URL env var at build time for containers; Vite proxy for local dev.
- [x] CHK005 - Are health check endpoint requirements specified for container orchestration readiness? [Completeness, Gap] — **Resolved**: GET /health returning { status: "ok" }. Used in Dockerfile HEALTHCHECK directive.
- [x] CHK006 - Are requirements defined for the local development workflow (how to start frontend + backend together)? [Completeness, Gap] — **Resolved**: Backend: `npm run dev`. Frontend: `npm run dev` (Vite with proxy). Or `docker-compose up`.
- [x] CHK007 - Are requirements defined for whether frontend static assets are served by the backend, a separate web server, or independently? [Completeness, Gap] — **Resolved**: Express serves the frontend assets in both the single-container image and local full-stack development mode.
- [x] CHK008 - Are logging requirements specified (log format, log levels, structured logging for container environments)? [Completeness, Gap] — **Resolved**: Console JSON (structured) in production. Pretty print in development. Levels: info, warn, error.
- [x] CHK009 - Are startup validation requirements defined (config file existence check, GitHub API reachability probe)? [Completeness, Gap] — **Resolved**: Validate primitives.json and assistants.json exist and are valid JSON. Log warning if GITHUB_TOKEN absent.

## Requirement Clarity

- [x] CHK010 - Is "ready for running in container" specified with concrete container runtime requirements (Docker, Podman, OCI-compatible)? [Clarity, Plan Technical Context] — **Resolved**: Docker (OCI-compatible). Tested with Docker Desktop.
- [x] CHK011 - Is "ready for running locally" defined with prerequisite versions, setup steps, and expected developer experience? [Clarity, Plan Technical Context] — **Resolved**: Node.js 20+, npm 9+. `npm install` in both dirs. `npm run dev` to start.
- [x] CHK012 - Is the relationship between docker-compose.yml services and their networking clearly defined? [Clarity, Plan Project Structure] — **Resolved**: A single app service binds host port 3000 and serves both SPA and API traffic.
- [x] CHK013 - Is "Node.js 20 LTS" a hard minimum requirement or a recommendation? [Clarity, Plan Technical Context] — **Resolved**: Hard minimum requirement. Enforced via package.json engines field.

## Requirement Consistency

- [x] CHK014 - Does the plan's docker-compose.yml structure align with the frontend/backend separation in the project structure? [Consistency, Plan §Project Structure] — **Resolved**: Yes. Docker-compose mirrors frontend/ and backend/ directory structure.
- [x] CHK015 - Is the "stateless, on-demand operation" assumption consistent with container restartability and horizontal scaling? [Consistency, Assumptions vs Deployment] — **Resolved**: Consistent. No volumes needed for state. Config baked into image. Containers are freely restartable.
- [x] CHK016 - Are the frontend and backend Dockerfiles independently buildable, consistent with the "independent scaling and deployment" statement in the plan? [Consistency, Plan §Structure Decision] — **Resolved**: Yes. Each Dockerfile is self-contained with independent build contexts.

## Scenario Coverage

- [x] CHK017 - Are requirements defined for graceful shutdown behavior when the container receives SIGTERM? [Coverage, Gap] — **Resolved**: SIGTERM handler in server.js closes HTTP server connections and exits cleanly.
- [x] CHK018 - Are requirements specified for running the application behind a reverse proxy (X-Forwarded headers, trust proxy settings)? [Coverage, Gap] — **Resolved**: Express trust proxy enabled. Standard X-Forwarded-* header support.
- [x] CHK019 - Are requirements defined for the production build process (frontend asset optimization, backend startup)? [Coverage, Gap] — **Resolved**: Frontend: `vite build` → dist/. Backend: copy src/ + `npm ci --production`.
- [x] CHK020 - Are requirements specified for how JSON config files are mounted/included in container images (baked in vs volume mount)? [Coverage, Gap] — **Resolved**: Baked into image by default. Can override via volume mount for customization.
- [x] CHK021 - Are requirements defined for what Node.js version incompatibility produces (clear error vs silent failure)? [Coverage, Gap] — **Resolved**: package.json engines field enforced. Clear error on version mismatch.
- [x] CHK022 - Are requirements specified for the development experience with hot-reload (Vite dev server proxy to backend)? [Coverage, Gap] — **Resolved**: Vite HMR for frontend. Nodemon for backend. Vite proxy config for API calls.

## Non-Functional Requirements

- [x] CHK023 - Are container image size constraints specified (to ensure fast pulls and deployments)? [Gap] — **Resolved**: Backend <100MB, frontend <50MB (Alpine base + multi-stage builds).
- [x] CHK024 - Are memory and CPU resource limits defined for container deployments? [Gap] — **Resolved**: Defined in docker-compose.yml. Backend: 256MB RAM, 0.5 CPU. Frontend: 128MB RAM, 0.25 CPU.
- [x] CHK025 - Are security requirements specified for the container (non-root user, read-only filesystem, minimal attack surface)? [Gap] — **Resolved**: Non-root user, read-only filesystem where possible, Alpine base for minimal attack surface.
- [x] CHK026 - Are TLS/HTTPS requirements specified for production deployment? [Gap] — **Resolved**: Not required for v1 local/container use. Handled by reverse proxy in production deployments.
- [x] CHK027 - Is a CI/CD pipeline requirement defined for automated builds, tests, and container image publishing? [Gap, Constitution §Development Workflow] — **Resolved**: T012 defines GitHub Actions CI pipeline. Container image publishing is a future enhancement.

## Dependencies & Assumptions

- [x] CHK028 - Is the assumption that both frontend and backend run in separate containers validated, or could a single container serve both? [Assumption] — **Resolved**: Separate containers chosen for independent scaling. Single container possible but not the default architecture.
- [x] CHK029 - Is the Node.js 20 LTS availability in container base images verified? [Assumption] — **Resolved**: Verified. `node:20-alpine` is available on Docker Hub.
- [x] CHK030 - Is the assumption that "no persistent storage" means no volume mounts are needed validated against config file access? [Assumption] — **Resolved**: Config files baked into image. No runtime volume needed for default operation.

## Notes

- The spec and plan focus heavily on functional behavior but contain minimal deployment and operational requirements. Most items are `[Gap]` markers.
- The plan mentions `docker-compose.yml` and `Dockerfile` in the project structure but the spec contains no deployment requirements — this is a significant coverage gap for a "container-ready" application.
- Environment variable management (especially `GITHUB_TOKEN`) needs explicit documentation for both local and containerized workflows.
