# 🤖 Is it AI-Native?

Scan any GitHub repository to assess how well it embraces AI-native development practices.

The scanner inspects a repo's file tree via the GitHub API and checks for the presence of AI-native development primitives — instruction files, reusable prompts, custom agents, skills, MCP server configurations, and agent hooks — across three supported AI coding assistants: **GitHub Copilot**, **Claude Code**, and **OpenAI Codex CLI**. It produces a per-assistant breakdown, an overall readiness score, and a verdict.

| Verdict | Score |
| --- | --- |
| **AI-Native** | ≥ 60 % |
| **AI-Assisted** | 30 – 59 % |
| **Traditional** | < 30 % |

### Key Features

- **Six primitive categories** — Instructions, Prompts, Agents, Skills, MCP Config, and Agent Hooks — mapped to glob patterns per assistant.
- **Report sharing** — Save scan results as shareable links under `/_/report/<uuid>` (backed by a file-based report store; enabled by default in production). Reports auto-expire after 90 days.
- **Operational telemetry** — Emit scan/report custom events to Azure Application Insights so counts, recent activity, and drill-down monitoring can live in Azure Workbooks instead of a bespoke in-app dashboard.
- **Configuration-driven** — Add new primitives or assistants by editing JSON files. No code changes required. See [Configuration Guide](docs/configuration.md).
- **Zero-to-production IaC** — Full Azure Container Apps deployment via Bicep, with CI/CD through GitHub Actions.

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
                                                   ┌───────▼──────────────┐
                                                   │  File-backed report   │
                                                   │  store (optional)     │
                                                   │  for shared reports   │
                                                   └───────────────────────┘
```

- **Frontend** — Vanilla HTML / CSS / JS single-page application. No build step required.
- **Backend** — Node.js 24 + Express (ESM). Calls the GitHub Trees API to fetch the file tree, matches paths against configurable glob patterns per primitive/assistant, and computes a readiness score.
- **Storage** — Optional file-backed storage for the report-sharing feature (enabled by default in production). Shared reports expire after 90 days.
- **Reverse Proxy** — In Docker Compose mode, Nginx serves static files and proxies `/api/*` and `/health` to the backend. In single-container mode, Express serves the frontend directly.

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

> **Tip:** Set a `GH_TOKEN_FOR_SCAN` environment variable to avoid GitHub API rate limits (60 req/h unauthenticated → 5 000 req/h authenticated).

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
| `GH_TOKEN_FOR_SCAN` | — | GitHub PAT to increase API rate limits for scanning |
| `ENABLE_SHARING` | `false` | Enable the report-sharing feature |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | — | Optional Azure Application Insights connection string used to emit scan/report telemetry for Azure Workbook dashboards |
| `REPORTS_DIR` | `./data/reports` | Directory where shared-report JSON files are stored |
| `DB_PATH` | `./data/reports.db` | Legacy compatibility setting used to derive the report storage directory when `REPORTS_DIR` is unset |
| `SERVE_FRONTEND` | `false` | Serve frontend static files from Express (single-container mode) |
| `FRONTEND_PATH` | `../frontend` | Path to the frontend directory (when `SERVE_FRONTEND=true`) |
| `ALLOWED_ORIGIN` | `false` (CORS disabled) | Allowed CORS origin (e.g., `http://localhost:5173`) |

Create a `.env` file in the project root for local overrides (it is git-ignored):

```env
GH_TOKEN_FOR_SCAN=ghp_your_personal_access_token
ENABLE_SHARING=true
```

---

## Cloud Deployment (Azure)

The application is designed to run on **Azure Container Apps** (Consumption plan) — a serverless container platform that scales to zero when idle and includes a free monthly grant.

### Infrastructure as Code (Bicep)

All Azure resources are defined in [`infra/main.bicep`](infra/main.bicep). A single `az deployment group create` provisions everything:

| Resource | Purpose |
| --- | --- |
| **Log Analytics Workspace** | Centralized container logs and diagnostics |
| **Application Insights** | Custom scan/report telemetry for Azure Workbook dashboards and drill-down monitoring |
| **Container Apps Environment** | Consumption plan host (no workload profiles needed) |
| **Container App** | The application with health / readiness probes, HTTP auto-scaling (0 → 3 replicas), and a system-assigned managed identity |
| **Azure Storage Account + File Share** | *(conditional, when `enableSharing=true`)* Azure Files mounted for shared-report persistence |

Optional features in the Bicep template:
- **ACR integration** — Pass `acrName` to pull images from Azure Container Registry using admin credentials stored as secrets.
- **Custom domain + managed TLS** — Pass `customDomainName` and `managedCertName` to bind a custom domain with a Let's Encrypt certificate.
- **Secondary custom domain + managed TLS** — Pass `secondaryCustomDomainName` and `secondaryManagedCertName` to keep a second hostname bound during migrations or gradual cutovers.

Default parameter values live in [`infra/main.bicepparam`](infra/main.bicepparam) for quick manual deployments. The CD workflow passes all parameters inline (`.bicepparam` files cannot be mixed with additional CLI overrides).

### CI / CD Pipelines

Two GitHub Actions workflows automate the full lifecycle:

| Workflow | File | Trigger | What it does |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | Push to non-main branches, PRs to `main` | Runs backend tests (Jest), builds the Docker image, scans it with [Trivy](https://trivy.dev/), and uploads SARIF results to GitHub Security |
| **CD** | `.github/workflows/cd.yml` | Push to `main` | Builds & pushes to GHCR, runs Trivy security scan, deploys to Azure via Bicep using OIDC (no long-lived credentials) |

**CD pipeline flow:**

```
build-push ──▶ security-scan ──▶ deploy
  (GHCR)         (Trivy)        (Azure OIDC + arm-deploy)
```

The deploy step uses `azure/arm-deploy@v2` with OIDC-based Azure login — the GitHub Actions runner exchanges a short-lived OIDC token for an Azure access token, so no service principal secrets need to be stored.

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
     --parameters namePrefix=is-ai-native \
                  enableSharing=true \
                  containerImage=ghcr.io/<owner>/is-ai-native:latest \
                  githubToken=<optional-pat>
   ```

   > **Note:** Do not mix a `.bicepparam` file with inline `--parameters` overrides — use one or the other.

### Custom Domain with Managed TLS

To bind a custom domain (e.g., `scan.example.com`) with a free Let's Encrypt certificate:

1. **Deploy without a custom domain first** (if you haven't already) and note the Container App's default FQDN from the deployment output (`appUrl`).

2. **Configure DNS** — Add **two** records with your DNS provider:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `scan.example.com` | `<namePrefix>-app.<env-default-domain>` (from step 1's `appUrl` output) |
   | TXT | `asuid.scan.example.com` | *Custom domain verification ID* (see step 3) |

3. **Get the domain verification ID** — This value must be set as a TXT record before certificate issuance will succeed:

   ```bash
   az containerapp env show \
     --name <namePrefix>-env \
     --resource-group <rg> \
     --query properties.customDomainConfiguration.customDomainVerificationId -o tsv
   ```

   Add the returned value as a TXT record at `asuid.<your-subdomain>` (e.g., `asuid.scan.example.com`).

4. **Add the hostname** to your Container App (required before creating the managed certificate):

   ```bash
   az containerapp hostname add \
     --name <namePrefix>-app \
     --resource-group <rg> \
     --hostname scan.example.com
   ```

5. **Create the managed certificate**:

   ```bash
   az containerapp env certificate create \
     --name <namePrefix>-env \
     --resource-group <rg> \
     --hostname scan.example.com \
     --validation-method CNAME
   ```

   Wait until `provisioningState` shows **Succeeded** (this may take a few minutes):

   ```bash
   az containerapp env certificate list \
     --name <namePrefix>-env \
     --resource-group <rg> \
     --query "[].{name:name, domain:properties.subjectName, state:properties.provisioningState}"
   ```

6. **Bind the certificate to the hostname** — note the certificate name from the previous step's output:

   ```bash
   az containerapp hostname bind \
     --name <namePrefix>-app \
     --resource-group <rg> \
     --hostname scan.example.com \
     --environment <namePrefix>-env \
     --certificate <cert-name-from-step-5>
   ```

   Alternatively, redeploy with the custom domain Bicep parameters (pass via CLI — do not commit domain-specific values to the repo):

   ```bash
   az deployment group create \
     --resource-group <rg> \
     --template-file infra/main.bicep \
     --parameters namePrefix=is-ai-native \
                  enableSharing=true \
                  containerImage=ghcr.io/<owner>/is-ai-native:latest \
                  customDomainName='scan.example.com' \
                  managedCertName='<cert-name-from-step-5>'
   ```

   To keep an existing hostname active during a migration, pass both domain/certificate pairs in the same deployment:

   ```bash
   az deployment group create \
     --resource-group <rg> \
     --template-file infra/main.bicep \
     --parameters namePrefix=is-ai-native \
                  enableSharing=true \
                  containerImage=ghcr.io/<owner>/is-ai-native:latest \
                  customDomainName='new.example.com' \
                  managedCertName='<new-cert-name>' \
                  secondaryCustomDomainName='old.example.com' \
                  secondaryManagedCertName='<old-cert-name>'
   ```

7. **Verify** the binding:

   ```bash
   az containerapp show \
     --name <namePrefix>-app \
     --resource-group <rg> \
     --query properties.configuration.ingress.customDomains
   ```

> **Troubleshooting:** If the certificate stays in "Pending" state, verify that both DNS records (CNAME and TXT) are correctly configured. Use `nslookup -type=TXT asuid.scan.example.com` to confirm the TXT record is resolvable. The TXT value must match the `customDomainVerificationId` exactly.

### Azure Secrets for GitHub Actions

Configure the following secrets in your GitHub repository for the CD pipeline:

| Secret | Description |
| --- | --- |
| `AZURE_CLIENT_ID` | App registration client ID (for OIDC) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `GH_TOKEN_FOR_SCAN` | *(optional)* GitHub PAT passed to the container for higher API rate limits |
| `CUSTOM_DOMAIN_NAME` | *(optional)* Custom domain name (e.g., `scan.example.com`). Leave empty to use the default Azure FQDN |
| `MANAGED_CERT_NAME` | *(optional)* Name of the managed certificate created in the [Custom Domain](#custom-domain-with-managed-tls) setup |
| `SECONDARY_CUSTOM_DOMAIN_NAME` | *(optional)* Secondary custom domain to keep bound during migrations or parallel-hostname support |
| `SECONDARY_MANAGED_CERT_NAME` | *(optional)* Managed certificate name for `SECONDARY_CUSTOM_DOMAIN_NAME` |

---

## Azure Workbook Monitoring

The Azure deployment can emit custom Application Insights events for each successful scan and each shared-report creation. This gives you Azure-native monitoring without adding a separate persistence-backed dashboard to the app itself.

The primary custom event names are:

- `scan_completed`
- `scan_failed`
- `report_created`

Use the workspace-based `customEvents` table for Workbook queries.

**Total scans**

```kusto
customEvents
| where name == "scan_completed"
| summarize total_scans = count()
```

**Total reports**

```kusto
customEvents
| where name == "report_created"
| summarize total_reports = count()
```

**Recent scans**

```kusto
customEvents
| where name == "scan_completed"
| project timestamp, repo_name = tostring(customDimensions.repo_name), verdict = tostring(customDimensions.verdict), score = todouble(customMeasurements.score), duration_ms = todouble(customMeasurements.duration_ms)
| order by timestamp desc
```

**Recent reports joined back to scans**

```kusto
let scans = customEvents
| where name == "scan_completed"
| project scan_key = tostring(customDimensions.scan_key), scan_time = timestamp, repo_name = tostring(customDimensions.repo_name), score = todouble(customMeasurements.score), verdict = tostring(customDimensions.verdict);
let reports = customEvents
| where name == "report_created"
| project scan_key = tostring(customDimensions.scan_key), report_time = timestamp, report_id = tostring(customDimensions.report_id);
scans
| join kind=leftouter reports on scan_key
| order by scan_time desc
```

This monitoring surface is intended for operators in Azure. The SPA still only renders live scan results and shared reports.

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
{ "id": "uuid", "url": "/_/report/uuid" }
```

### `GET /api/report/:id`

Retrieve a shared report by ID *(requires `ENABLE_SHARING=true`)*. Reports expire after 90 days.

### `GET /health`

Health check endpoint. Returns runtime capability flags such as scan token availability, report sharing status, and whether Application Insights telemetry is enabled.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app entry point
│   │   ├── config/
│   │   │   ├── primitives.json # AI-native primitive definitions & patterns
│   │   │   └── assistants.json # Supported AI assistant metadata
│   │   ├── routes/
│   │   │   ├── scan.js        # POST /api/scan
│   │   │   ├── report.js      # GET/POST /api/report
│   │   │   └── config.js      # GET /api/config
│   │   └── services/
│   │       ├── scanner.js     # GitHub API integration & scoring logic
│   │       ├── app-insights.js # Azure Application Insights event emission
│   │       └── storage.js     # File-backed persistence for shared reports
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
│   ├── main.bicep             # Azure Container Apps IaC (all resources)
│   └── main.bicepparam        # Default deployment parameters
├── docs/
│   └── configuration.md       # Configuration guide for primitives & assistants
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
