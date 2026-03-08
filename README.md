# 🤖 Is it AI-Native?

Scan any GitHub repository to assess how well it embraces AI-native development practices.

The scanner inspects a repo's file tree via the GitHub API and checks for the presence of AI assistant configurations (GitHub Copilot, Cursor, Windsurf, Aider), agent instructions, spec frameworks, CI/CD pipelines, issue/PR templates, dev containers, and other engineering primitives — then produces a score and verdict.

| Verdict | Score |
| --- | --- |
| **AI-Native** | ≥ 60 % |
| **AI-Assisted** | 30 – 59 % |
| **Traditional** | < 30 % |

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
  - [Backend Only](#backend-only)
  - [Full Stack with Docker Compose](#full-stack-with-docker-compose)
  - [Single Container](#single-container)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Cloud Deployment (Azure)](#cloud-deployment-azure)
  - [CI / CD Pipelines](#ci--cd-pipelines)
  - [Manual Deployment with Bicep](#manual-deployment-with-bicep)
  - [Azure Secrets for GitHub Actions](#azure-secrets-for-github-actions)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [License](#license)

---

## Architecture

```
┌──────────────┐        ┌──────────────────┐        ┌────────────────┐
│   Browser    │──80──▶│  Nginx / Express  │──3000─▶│  Express API   │
│  (SPA)       │       │  (static files)   │        │  (Node.js 24)  │
└──────────────┘        └──────────────────┘        └───────┬────────┘
                                                            │
                                                   ┌───────▼────────┐
                                                   │  GitHub API    │
                                                   │  (repo scan)   │
                                                   └───────┬────────┘
                                                            │
                                                   ┌───────▼────────┐
                                                   │  SQLite (opt.) │
                                                   │  (shared       │
                                                   │   reports)     │
                                                   └────────────────┘
```

- **Frontend** — Vanilla HTML / CSS / JS single-page application. No build step required.
- **Backend** — Node.js 24 + Express (ESM). Calls the GitHub Trees API to fetch the file tree and scores the repository.
- **Database** — Optional SQLite storage for the report-sharing feature. Shared reports expire after 90 days.
- **Reverse Proxy** — In Docker Compose mode, Nginx serves static files and proxies `/api/*` to the backend. In single-container mode, Express serves the frontend directly.

---

## Prerequisites

| Tool | Version | Required for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 24+ | Backend development & tests |
| [Docker](https://www.docker.com/) | 20+ | Container builds |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ | Full-stack local run |
| [Azure CLI](https://learn.microsoft.com/cli/azure/) | 2.x | Cloud deployment |

---

## Local Development

### Backend Only

The quickest way to get started — run the Express API on its own:

```bash
cd backend
npm install
npm run dev          # starts with --watch for live reload
```

The API is now available at **http://localhost:3000**. Use any HTTP client to test:

```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/webmaxru/is-ai-native"}'
```

> **Tip:** Set a `GITHUB_TOKEN` environment variable to avoid GitHub API rate limits (60 req/h unauthenticated → 5 000 req/h authenticated).

### Full Stack with Docker Compose

Run both the frontend (Nginx) and backend as separate containers:

```bash
docker compose up --build
```

Open **http://localhost** in your browser. Nginx serves the SPA and proxies `/api/*` requests to the backend.

To stop:

```bash
docker compose down
```

### Single Container

The root `Dockerfile` produces a single image that bundles the Express API **and** the frontend static files (served by Express when `SERVE_FRONTEND=true`):

```bash
docker build -t is-ai-native .
docker run -p 3000:3000 \
  -e SERVE_FRONTEND=true \
  -e NODE_ENV=production \
  is-ai-native
```

Open **http://localhost:3000**.

---

## Testing

The backend includes unit, contract, and integration tests powered by [Jest](https://jestjs.io/) and [Supertest](https://github.com/ladjs/supertest):

```bash
cd backend
npm install
npm test                # run all tests
npm run test:unit       # unit tests only
npm run test:contract   # contract tests only
npm run test:integration # integration tests only
```

---

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the Express server listens on |
| `NODE_ENV` | — | Set to `production` in deployed environments |
| `GITHUB_TOKEN` | — | GitHub PAT to increase API rate limits for scanning |
| `ENABLE_SHARING` | `false` | Enable the report-sharing feature (requires SQLite) |
| `DB_PATH` | `./data/reports.db` | Path to the SQLite database file |
| `SERVE_FRONTEND` | `false` | Serve frontend static files from Express (single-container mode) |
| `FRONTEND_PATH` | `../frontend` | Path to the frontend directory (when `SERVE_FRONTEND=true`) |
| `ALLOWED_ORIGIN` | `false` (CORS disabled) | Allowed CORS origin (e.g., `http://localhost:5173`) |

Create a `.env` file in the project root for local overrides (it is git-ignored):

```env
GITHUB_TOKEN=ghp_your_personal_access_token
ENABLE_SHARING=true
```

---

## Cloud Deployment (Azure)

The application is designed to run on **Azure Container Apps** (Consumption plan) — a serverless container platform that scales to zero when idle.

### CI / CD Pipelines

Two GitHub Actions workflows automate the full lifecycle:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| **CI** (`.github/workflows/ci.yml`) | Push to non-main branches, PRs to main | Runs backend tests, builds the Docker image, scans it with [Trivy](https://trivy.dev/) |
| **CD** (`.github/workflows/cd.yml`) | Push to `main` | Builds & pushes image to GHCR, runs Trivy security scan, deploys to Azure via Bicep |

The CD pipeline uses **OIDC-based Azure login** — no long-lived credentials are stored as secrets.

### Manual Deployment with Bicep

If you prefer to deploy manually:

1. **Build and push the container image** to a registry (e.g., GitHub Container Registry):

   ```bash
   docker build -t ghcr.io/<owner>/is-ai-native:latest .
   docker push ghcr.io/<owner>/is-ai-native:latest
   ```

2. **Create a resource group** (if it doesn't exist):

   ```bash
   az group create --name is-ai-native-rg --location eastus2
   ```

3. **Deploy the infrastructure**:

   ```bash
   az deployment group create \
     --resource-group is-ai-native-rg \
     --template-file infra/main.bicep \
     --parameters @infra/main.bicepparam \
     --parameters containerImage=ghcr.io/<owner>/is-ai-native:latest \
                  githubToken=<optional-pat>
   ```

The Bicep template provisions:
- **Log Analytics Workspace** — centralized logging
- **Container Apps Environment** — Consumption plan (free monthly grant, scales to zero)
- **Container App** — the application itself with health probes, auto-scaling (0 → 3 replicas), and a system-assigned managed identity
- **Azure Storage** *(optional, when `enableSharing=true`)* — Azure Files share mounted for SQLite persistence

### Azure Secrets for GitHub Actions

Configure the following secrets in your GitHub repository for the CD pipeline:

| Secret | Description |
| --- | --- |
| `AZURE_CLIENT_ID` | App registration client ID (for OIDC) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `GITHUB_TOKEN_FOR_SCAN` | *(optional)* GitHub PAT passed to the container for higher API rate limits |

---

## API Reference

### `POST /api/scan`

Scan a GitHub repository.

**Request body:**

```json
{ "repo_url": "https://github.com/owner/repo" }
```

**Response:** Scan result with score, verdict, detected assistants, and primitives.

### `GET /api/config`

Returns server configuration flags.

**Response:**

```json
{ "sharingEnabled": false }
```

### `POST /api/report`

Save a scan result for sharing *(requires `ENABLE_SHARING=true`)*.

**Request body:**

```json
{ "result": { /* scan result object */ } }
```

**Response:**

```json
{ "id": "uuid", "url": "/report/uuid" }
```

### `GET /api/report/:id`

Retrieve a shared report by ID *(requires `ENABLE_SHARING=true`)*. Reports expire after 90 days.

### `GET /health`

Health check endpoint. Returns `{ "status": "ok" }`.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app entry point
│   │   ├── routes/
│   │   │   ├── scan.js        # POST /api/scan
│   │   │   ├── report.js      # GET/POST /api/report
│   │   │   └── config.js      # GET /api/config
│   │   └── services/
│   │       ├── scanner.js     # GitHub API integration & scoring logic
│   │       └── storage.js     # SQLite persistence for shared reports
│   ├── tests/                 # Jest test suites (unit, contract, integration)
│   ├── package.json
│   └── Dockerfile             # Backend-only image (used by docker-compose)
├── frontend/
│   ├── index.html             # SPA entry point
│   ├── src/
│   │   ├── app.js             # Application logic & routing
│   │   ├── api.js             # API client
│   │   ├── report.js          # Report rendering
│   │   └── main.css           # Styles
│   └── tests/                 # Frontend unit tests
├── infra/
│   ├── main.bicep             # Azure Container Apps IaC
│   └── main.bicepparam        # Default deployment parameters
├── nginx/
│   └── nginx.conf             # Reverse proxy config (docker-compose)
├── .github/
│   └── workflows/
│       ├── ci.yml             # CI: test, build, scan
│       └── cd.yml             # CD: build, push, deploy to Azure
├── Dockerfile                 # Single-container production image
├── docker-compose.yml         # Multi-container local development
└── README.md
```

---

## License

This project is licensed under the [MIT License](LICENSE).
