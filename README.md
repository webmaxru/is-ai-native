# 🤖 Is it AI-Native?

Scan any GitHub repository to assess how well it embraces AI-native development practices.

The scanner inspects a repo's file tree via the GitHub API and checks for the presence of AI-native development primitives — instruction files, reusable prompts, custom agents, skills, MCP server configurations, and agent hooks — across three supported AI coding assistants: **GitHub Copilot**, **Claude Code**, and **OpenAI Codex**. It produces a per-assistant breakdown, an overall readiness score based on assistant-specific primitive coverage, and a verdict based on the strongest per-assistant score.

| Verdict | Strongest Assistant Score |
| --- | --- |
| **AI-Native** | ≥ 60 % |
| **AI-Assisted** | 30 – 59 % |
| **Traditional** | < 30 % |

### Key Features

- **Six primitive categories** — Instructions, Prompts, Agents, Skills, MCP Config, and Agent Hooks — mapped to glob patterns per assistant.
- **Report sharing** — Save scan results as shareable links under `/_/report/<uuid>` (backed by a file-based report store; enabled by default in production). Reports auto-expire after 90 days.
- **Operational telemetry** — Emit scan/report custom events to Azure Application Insights so counts, recent activity, report views, and drill-down monitoring can live in Azure Workbooks instead of a bespoke in-app dashboard.
- **Operational telemetry** — Emit scan/report/rate-limit custom events to Azure Application Insights so counts, recent activity, report views, abuse signals, and drill-down monitoring can live in Azure Workbooks instead of a bespoke in-app dashboard.
| `SCAN_RATE_LIMIT_MAX` | `120` | Maximum requests per IP within the scan limiter window |
| `REPORT_RATE_LIMIT_WINDOW_MS` | `900000` | Window length in milliseconds for the `/api/report` limiter |
| `REPORT_RATE_LIMIT_MAX` | `240` | Maximum unsafe requests per IP within the report limiter window; safe `GET`/`HEAD`/`OPTIONS` requests are exempt |
- **Configuration-driven** — Add new primitives or assistants by editing JSON files. No code changes required. See [Configuration Guide](docs/configuration.md).
- **Weekly assistant maintenance** — Supporting skills and scanner configuration are reviewed weekly through a GitHub Agentic Workflow that scans multiple upstream documentation sources, filters and ranks relevant spec drift, and proposes minimal updates as a draft PR that still requires human review before merge.
- **Zero-to-production IaC** — Full Azure Container Apps deployment via Bicep, with CI/CD through GitHub Actions.

> [!IMPORTANT]
> **Repo-maintained AI skills power this project.**
> This application uses the **WebMCP** and **GitHub Agentic Workflows** skills maintained in the companion [webmaxru/agent-skills](https://github.com/webmaxru/agent-skills/) repository.
>
> Skills currently exposed by the `agent-skills` repo:
> - **Agent Package Manager**
> - **GitHub Agentic Workflows**
> - **Language Detector API**
> - **Prompt API**
> - **Proofreader API**
> - **Translator API**
> - **WebMCP**
> - **WebNN**
> - **Writing Assistance APIs**
>
> These skills are reviewed regularly and manually validated before changes are relied on in the app's workflows, scanner maintenance, and supporting automation.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
  - [Backend Only](#backend-only)
  - [CLI](#cli)
  - [VS Code Extension](#vs-code-extension)
  - [Full Stack with Docker Compose](#full-stack-with-docker-compose)
  - [Single Container](#single-container)
- [Supporting Automation](#supporting-automation)
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
┌──────────────┐        ┌────────────────┐
│   Browser    │──3000─▶│ Express App     │
│  (SPA)       │        │ SPA + API       │
└──────────────┘        └───────┬────────┘
                                │
                       ┌────────▼────────┐
                       │  GitHub API     │
                       │  (repo scan)    │
                       └────────┬────────┘
                                │
                       ┌────────▼──────────────┐
                       │  File-backed report   │
                       │  store (optional)     │
                       │  for shared reports   │
                       └───────────────────────┘
```

- **Frontend** — Vanilla HTML / CSS / JS single-page application. No build step required.
- **WebMCP preview** — When Chrome WebMCP is enabled, the hosted web app exposes both an imperative `scan_repository` tool and a declarative `scan_repository_form` tool backed by the same repo-scan flow.
- **Backend** — Node.js 24 + Express (ESM). Calls the GitHub Trees API to fetch the file tree, matches paths against configurable glob patterns per primitive/assistant, and computes a readiness score from detected assistant-specific primitive matches.
- **Shared Core** — `packages/core` contains the reusable config loading, repository scanning, scoring, GitHub tree access, and orchestration APIs used by all clients.
- **CLI** — `packages/cli` provides the terminal / GitHub CLI surface for local-path and GitHub-target scanning on top of the shared core.
- **VS Code Extension** — `packages/vscode-extension` provides workspace and GitHub scanning commands plus a results webview on top of the shared core.
- **Storage** — Optional file-backed storage for the report-sharing feature (enabled by default in production). Shared reports expire after 90 days.
- **Serving model** — Express serves both the SPA and the API in local single-container runs and in Azure Container Apps.

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

For workspace-based development, you can install shared dependencies once from the repository root with `npm install` and then run package-specific scripts. The commands below still work when you prefer operating from the backend package directly.

```powershell
cd webapp/backend
npm install
npm run dev          # starts with --watch for live reload
```

The API is now available at **http://localhost:3000**. On Windows PowerShell, use `Invoke-RestMethod` to test it:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/scan -ContentType "application/json" -Body '{"repo_url":"https://github.com/webmaxru/is-ai-native"}'
```

> **Tip:** Set a `GH_TOKEN_FOR_SCAN` environment variable to avoid GitHub API rate limits (60 req/h unauthenticated → 5 000 req/h authenticated).
> The backend `npm` scripts automatically load the repository-root `.env` when it exists, so local overrides are picked up in development.

### Full Stack Without Docker

Run the backend and frontend together through the Express server:

```powershell
cd webapp/backend
npm install
npm run dev:full
```

Open **http://localhost:3000** in your browser.

This mode serves the SPA directly from the local `webapp/frontend/` directory and keeps the backend API on the same origin, so no extra frontend dev server or CORS setup is required.

To test the WebMCP preview in Chromium-based browser, enable `about://flags/#enable-webmcp-testing`. The page exposes:

- `scan_repository` through `navigator.modelContext.registerTool(...)`
- `scan_repository_form` through the annotated repo scan form

### CLI

The repository includes a standalone Node CLI in [packages/cli/README.md](packages/cli/README.md) and separate GitHub CLI extension export tooling in [packages/gh-extension/README.md](packages/gh-extension/README.md).

Current status:

- The package is prepared to publish to npm as `is-ai-native`.
- Once published, it will support `npm install is-ai-native` and a no-install standalone release bundle.
- It can generate a standalone `gh-is-ai-native` repository for native `gh extension install` distribution.
- It uses the same shared scan engine and configuration as the web app and VS Code extension.

Build and test the two CLI surfaces separately from the repository root:

```powershell
npm install
npm run build:cli
npm run test:cli
npm run build:gh-extension
npm run test:gh-extension
```

To build the generated GitHub CLI extension repository contents locally:

```powershell
npm install
npm run build:gh-extension
```

That command writes a standalone extension layout to `artifacts/gh-extension/repo`. The source repository also includes `.github/workflows/gh-extension-sync.yml`, which can push those generated contents to a dedicated `owner/gh-is-ai-native` repository by using the `GH_EXTENSION_REPOSITORY` repository variable and `GH_EXTENSION_SYNC_TOKEN` secret.

Run it directly from source from the repository root:

```powershell
npm install
node packages/cli/bin/cli.js --help
```

After the npm package is published, install and run it with:

```powershell
npm install is-ai-native
is-ai-native --help
```

If you want to avoid npm installation entirely, download the standalone CLI bundle from the tagged GitHub release assets, extract it, and run the bundled executable directly while keeping the extracted files together.

To build that portable bundle locally:

```powershell
npm install
npm run build:cli:standalone
```

That command writes a platform-specific bundle to `artifacts/cli/standalone/<platform>-<arch>`.

For a coordinated release across the VS Code extension, standalone CLI, and GitHub CLI extension, use the root release automation:

```powershell
npm run release:all -- 0.1.4 --dry-run
npm run release:all -- 0.1.4 --publish --push
```

That command aligns versions in all three package manifests, refreshes `package-lock.json`, runs the release build and test checks, publishes the VS Code extension, syncs the GitHub CLI extension repository, and pushes the `cli-v<version>` tag that triggers npm trusted publishing for the standalone CLI.

Tagged CLI releases are published by `.github/workflows/publish-cli.yml`. The release tag format is `cli-v<version>` and it must match `packages/cli/package.json`.

The workflow is intended to use npm trusted publishing through GitHub Actions OIDC, not a long-lived npm automation token. npm-side configuration still needs to be added once for the `is-ai-native` package by registering `publish-cli.yml` as its trusted publisher.

If you want a shell command during local development, link the package from the workspace root:

```powershell
npm install
npm link .\packages\cli
is-ai-native --help
```

Supported command:

```powershell
is-ai-native scan [target] [--output human|json|csv|summary] [--branch <branch>] [--token <token>] [--fail-below <score>]
```

If `target` is omitted, the CLI scans the current workspace.

Examples:

```powershell
is-ai-native scan
is-ai-native scan .
is-ai-native scan microsoft/vscode --output summary
is-ai-native scan https://github.com/microsoft/vscode --branch main
is-ai-native scan . --output summary --fail-below 60
```

CLI output modes:

- `human`: default readable console report with score, verdict, assistant scores, and primitive matches
- `json`: full machine-readable scan result
- `csv`: one row per primitive for spreadsheet or pipeline usage
- `summary`: one-line status output for scripts and CI

CLI exit codes:

- `0`: scan succeeded and any `--fail-below` threshold was met
- `1`: usage error or runtime failure
- `2`: scan succeeded, but the resulting score was below `--fail-below`

For GitHub repository scans, the CLI resolves tokens in this order:

- `--token`
- `GITHUB_TOKEN`
- `GH_TOKEN_FOR_SCAN`

### VS Code Extension

The repository includes a VS Code extension in [packages/vscode-extension/README.md](packages/vscode-extension/README.md). It reuses the same shared scan core as the web app and CLI package.

Current status:

- The extension manifest is configured for VS Code Marketplace packaging and publishing.
- The bundle entry point is `packages/vscode-extension/dist/extension.js`.
- The extension bundle must stay ESM because the shared core uses `import.meta.url` to load bundled configuration.

Build and test it from the repository root:

```powershell
npm install
npm run build:vscode-extension
npm run test:vscode-extension
```

Run it from source in VS Code:

1. Open the repository in VS Code or VS Code Insiders.
2. Run `npm install` from the repository root.
3. Run `npm run build:vscode-extension`.
4. Start an Extension Development Host from the Run and Debug view.

The extension currently contributes these commands:

- `Is AI-Native: Scan Workspace`
- `Is AI-Native: Scan GitHub Repository`
- `Is AI-Native: Open Last Results`

Extension features:

- Scans the currently opened workspace folder without sending local source files through the web application.
- Scans GitHub repositories directly using the shared core.
- Opens a results webview with overall score, verdict, assistant breakdown, and primitive-level matches.
- Lets you click matched local workspace files in the results view to open them directly in the editor.

Extension setting:

- `isAiNative.githubToken`: optional GitHub token used for remote repository scans from inside the extension

Current limitations:

- File-opening actions are only available for local workspace scans, not remote GitHub scans.
- The extension is currently command-driven with a results webview. It does not yet provide a dedicated sidebar view or tree view.

### Full Stack with Docker Compose

Run the same single-container image that Azure deploys:

Make sure port `3000` is free before starting it. If you already have `npm run dev` or `npm run dev:full` running locally, stop that process first.

```powershell
docker compose up --build
```

Open **http://localhost:3000** in your browser. Express serves the SPA and the API from the same container.

Docker Compose also reads the project-root `.env` file for variable substitution, so optional values such as `GH_TOKEN_FOR_SCAN`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, and `ALLOWED_ORIGIN` are passed through automatically when present.

To stop:

```powershell
docker compose down
```

### Single Container

The root `Dockerfile` produces a single image that bundles the Express API **and** the frontend static files. Express serves the bundled frontend automatically when it is present:

This command also expects host port `3000` to be available.

```powershell
docker build -t is-ai-native .
docker run -p 3000:3000 -e NODE_ENV=production is-ai-native
```

Open **http://localhost:3000**.

If you want the standalone container run to use optional local settings, pass them explicitly with additional `-e` flags such as `GH_TOKEN_FOR_SCAN`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, or `ALLOWED_ORIGIN`.

---

## Supporting Automation

The repository includes a GitHub Agentic Workflow at [`.github/workflows/weekly-assistant-config-review.md`](.github/workflows/weekly-assistant-config-review.md) to keep supporting skills, prompts, and scanner configuration aligned with current assistant platform documentation.

GitHub Agentic Workflows are markdown-authored automations that run inside GitHub Actions with an explicit agent, tool list, network policy, and safe outputs. In this repository, the weekly workflow runs on a weekly schedule with the `assistant-config-curator` agent, fetches the vendor documentation sources listed in [docs/configuration.md](docs/configuration.md), compares them against the current repository-scoped assistant model, and narrows any detected drift down to the smallest relevant changes.

The workflow is intentionally constrained:

- it starts in maintenance mode and only broadens scope if the review finds a genuinely new repository-scoped capability
- it keeps network access limited to the vendor documentation hosts it needs
- it uses safe outputs to create a draft pull request rather than merging changes directly
- it calls `noop` when the weekly scan finds no justified edits

That means weekly skills and scanner updates are proposed automatically from multiple documentation sources, with relevance filtering before a PR is opened, but every merge still depends on a mandatory human check and approval step.

---

## Testing

The backend includes unit, contract, and integration tests powered by [Jest](https://jestjs.io/) and [Supertest](https://github.com/ladjs/supertest):

```powershell
cd webapp/backend
npm install
npm test                # run all tests
npm run test:unit       # unit tests only
npm run test:contract   # contract tests only
npm run test:integration # integration tests only
```

The shared scan engine also has direct package-level tests:

```powershell
npm install
npm run test:frontend
npm run test:core
npm run test:cli
npm run test:gh-extension
npm run test:vscode-extension
npm run build:cli
npm run build:vscode-extension
```

Client-surface coverage is split this way:

- `npm run test:frontend` validates the browser-side WebMCP repo scan helper and shared tool payload formatting
- `npm run test:cli` validates terminal CLI behavior and output formatting
- `npm run test:gh-extension` validates the GitHub CLI extension export build and generated launcher bundle
- `npm run test:vscode-extension` validates extension-side helpers and rendering logic
- `npm run build:cli` verifies the standalone CLI workspace package entrypoint without generating a bundled artifact
- `npm run build:vscode-extension` validates the extension bundle that VS Code loads

---

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the Express server listens on |
| `NODE_ENV` | — | Set to `production` in deployed environments |
| `GH_TOKEN_FOR_SCAN` | — | GitHub PAT to increase API rate limits for scanning |
| `ENABLE_SHARING` | `false` | Enable the report-sharing feature for GitHub repository scan results |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | — | Optional Azure Application Insights connection string used to emit scan/report/view telemetry for Azure Workbook dashboards |
| `PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` | `APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional connection string exposed to the SPA via `/api/config` so frontend page views, sessions, and UI events are tracked in Application Insights |
| `CONTAINER_STARTUP_STRATEGY` | `scale-to-zero` | Deployment metadata exposed by the backend to describe whether Azure Container Apps is allowed to scale to zero or keeps one warm replica |
| `CONTAINER_MIN_REPLICAS` | `0` | Deployment metadata exposed by the backend to report the configured minimum replica count |
| `REPORTS_DIR` | `./data/reports` | Directory where shared-report JSON files are stored |
| `FRONTEND_PATH` | unset | Optional path to the frontend directory, such as `./webapp/frontend`, when Express should serve a source checkout frontend instead of the bundled container assets |
| `TRUST_PROXY` | `1` in production, otherwise `false` | Express proxy trust setting used for client IP and rate-limit handling. Set this explicitly when deploying behind a non-default proxy chain. |
| `SCAN_RATE_LIMIT_WINDOW_MS` | `900000` | Window length in milliseconds for the `/api/scan` limiter |
| `SCAN_RATE_LIMIT_MAX` | `120` | Maximum requests per client IP within the scan limiter window |
| `REPORT_RATE_LIMIT_WINDOW_MS` | `900000` | Window length in milliseconds for the `/api/report` limiter |
| `REPORT_RATE_LIMIT_MAX` | `240` | Maximum unsafe requests per client IP within the report limiter window; safe `GET`/`HEAD`/`OPTIONS` requests are exempt |
| `ALLOWED_ORIGIN` | `false` (CORS disabled) | Allowed CORS origin (e.g., `http://localhost:5173`) |
| `SITE_ORIGIN` | unset | Public base URL used for canonical tags, sitemap entries, and social card URLs |
| `SITE_NAME` | `IsAINative` | Product name used in structured data and web manifest |
| `SITE_SHORT_NAME` | `SITE_NAME` | Short product label used in the web manifest |
| `DEFAULT_PAGE_TITLE` | built-in default | Homepage title tag |
| `DEFAULT_META_DESCRIPTION` | built-in default | Homepage meta description and social summary |
| `TWITTER_HANDLE` | unset | Optional X/Twitter handle for social cards |
| `ALLOW_SITE_INDEXING` | `true` in production, otherwise `false` | Controls whether the homepage is indexable and whether `robots.txt` allows crawling |

Create a `.env` file in the project root for local overrides. The backend `npm` scripts load it directly, and Docker Compose uses it for variable substitution. The file is git-ignored:

```env
GH_TOKEN_FOR_SCAN=ghp_your_personal_access_token
ENABLE_SHARING=true
```

Brand assets are generated from [assets/logo.svg](assets/logo.svg). Rebuild the web, GH extension, and VS Code extension icon set with:

```powershell
npm run build:brand-assets
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
| **Action Group + Availability Test + Alert Rule** | *(conditional, when `monitoringAlertEmail` is provided)* Lowest-cost email alerting when the public site fails |

Optional features in the Bicep template:
- **ACR integration** — Pass `acrName` to pull images from Azure Container Registry using admin credentials stored as secrets.
- **Custom domain + managed TLS** — Pass `customDomainName` and `managedCertName` to bind a custom domain with a Let's Encrypt certificate.
- **Secondary custom domain + managed TLS** — Pass `secondaryCustomDomainName` and `secondaryManagedCertName` to keep a second hostname bound during migrations or gradual cutovers.
- **Startup strategy toggle** — Pass `containerStartupStrategy=keep-warm` to keep one replica ready and avoid scale-to-zero cold starts. The default `scale-to-zero` setting minimizes cost.
- **Low-cost website monitoring** — Pass `monitoringAlertEmail` to create one standard availability test, one email action group, and one alert rule. By default, the probe targets the default Container App URL; pass `monitoringUrl` if you want to monitor a custom domain instead.

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
                  containerStartupStrategy=keep-warm \
                  containerImage=ghcr.io/<owner>/is-ai-native:latest \
                  githubToken=<optional-pat> \
                  monitoringAlertEmail=salnikov@gmail.com
   ```

   > **Note:** Do not mix a `.bicepparam` file with inline `--parameters` overrides — use one or the other.

  > **Minimum-cost monitoring:** this creates a single standard Application Insights availability test that runs every 15 minutes from 1 region and sends email when that location fails. This is the cheapest profile in the repository, but detection can take up to about 15 minutes.

   If you want to monitor the public custom domain instead of the default Azure URL, add a full `monitoringUrl` override:

   ```bash
   az deployment group create \
     --resource-group is-ai-native-rg \
     --template-file infra/main.bicep \
     --parameters namePrefix=is-ai-native \
                  enableSharing=true \
                  containerImage=ghcr.io/<owner>/is-ai-native:latest \
                  monitoringAlertEmail=salnikov@gmail.com \
                  monitoringUrl='https://scan.example.com/'
   ```

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
| `MONITORING_ALERT_EMAIL` | *(optional)* Email address that receives Azure availability alerts. Defaults to `salnikov@gmail.com` in the workflow when the secret is not set |
| `COPILOT_GITHUB_TOKEN` | Required by the weekly GH-AW workflow to run the Copilot engine for assistant configuration maintenance |
| `CUSTOM_DOMAIN_NAME` | *(optional)* Custom domain name (e.g., `scan.example.com`). Leave empty to use the default Azure FQDN |
| `MANAGED_CERT_NAME` | *(optional)* Name of the managed certificate created in the [Custom Domain](#custom-domain-with-managed-tls) setup |
| `SECONDARY_CUSTOM_DOMAIN_NAME` | *(optional)* Secondary custom domain to keep bound during migrations or parallel-hostname support |
| `SECONDARY_MANAGED_CERT_NAME` | *(optional)* Managed certificate name for `SECONDARY_CUSTOM_DOMAIN_NAME` |

The CD workflow reuses `SITE_ORIGIN` as the monitored URL when it is set. If `SITE_ORIGIN` is empty, the availability test falls back to the default Azure Container Apps URL.

The default monitoring email value is `salnikov@gmail.com`. If you want a different mailbox without editing the workflow, set the `MONITORING_ALERT_EMAIL` repository secret.

`COPILOT_GITHUB_TOKEN` is a GitHub Actions secret for agentic workflow execution only. It is not consumed by [infra/main.bicep](infra/main.bicep), so no Azure IaC parameter or app secret wiring is required for this automation.

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
{ "repo_url": "https://github.com/owner/repo", "branch": "main" }
```

`branch` is optional. The response includes the scan result plus metadata such as the scanned branch, source, and `paths_scanned`.

The web app, CLI package, and VS Code extension all consume this shared result shape, so fields such as `score`, `verdict`, `branch`, `paths_scanned`, `primitives`, and `per_assistant` stay aligned across clients. `score` reflects cross-assistant primitive coverage, while `verdict` reflects the highest per-assistant score.

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
├── webapp/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── server.js          # Express app entry point
│   │   │   ├── routes/
│   │   │   │   ├── scan.js        # POST /api/scan
│   │   │   │   ├── report.js      # GET/POST /api/report
│   │   │   │   └── config.js      # GET /api/config
│   │   │   └── services/
│   │   │       ├── scanner.js     # GitHub API integration & scoring logic
│   │   │       ├── app-insights.js # Azure Application Insights event emission
│   │   │       └── storage.js     # File-backed persistence for shared reports
│   │   ├── tests/                 # Jest test suites (unit, contract, integration)
│   │   └── package.json
│   └── frontend/
│       ├── index.html             # SPA entry point
│       ├── src/
│       │   ├── app.js             # Application logic & routing
│       │   ├── api.js             # API client
│       │   ├── report.js          # Report rendering
│       │   └── main.css           # Styles
│       └── tests/                 # Frontend unit tests
├── packages/
│   ├── core/
│   │   ├── config/            # Canonical assistant + primitive definitions
│   │   ├── src/               # Shared scanning, config, and orchestration logic
│   │   └── tests/             # Direct shared-core tests
│   ├── cli/
│   │   ├── bin/               # `is-ai-native` executable entrypoint
│   │   ├── README.md          # CLI usage and source-based workflow
│   │   ├── src/               # CLI scan adapters and formatters
│   │   └── tests/             # CLI package tests
│   └── vscode-extension/
│       ├── README.md          # Extension workflow and command reference
│       ├── src/               # Extension activation, workspace adapter, webview
│       ├── tests/             # Extension unit tests
│       └── dist/              # Bundled extension output
├── infra/
│   ├── main.bicep             # Azure Container Apps IaC (all resources)
│   └── main.bicepparam        # Default deployment parameters
├── docs/
│   └── configuration.md       # Configuration guide for primitives & assistants
├── .github/
│   └── workflows/
│       ├── ci.yml             # CI: test, build, scan
│       └── cd.yml             # CD: build, push, deploy to Azure
├── Dockerfile                 # Single-container production image
├── docker-compose.yml         # Azure-like single-container local run
└── README.md
```

---

## License

This project is licensed under the [MIT License](LICENSE).
