# Frontend Migration to Azure Static Web Apps

**Status:** Implemented
**Date:** 2026-08-21

## Outcome

The web application now deploys as two independent workloads:

- **Frontend:** generated static files hosted on Azure Static Web Apps Free
- **Backend:** Express API hosted on Azure Container Apps Consumption

The backend image no longer contains the SPA. Static assets are delivered by the SWA global edge network, while scans, backend telemetry setup, and shared-report storage remain in ACA.

## Free-Plan Constraint

Azure Static Web Apps can link an Azure Container App as a same-origin `/api` backend only on the **Standard** plan. The Free plan therefore cannot use the linked-backend design from the original proposal.

This implementation uses direct browser-to-ACA HTTPS requests instead:

1. CD deploys Bicep and reads the generated ACA URL.
2. The frontend build writes that origin to `runtime-config.js`.
3. `webapp/frontend/src/api.js` sends API requests to `<ACA origin>/api`.
4. Bicep configures ACA with the exact SWA default origin and optional public custom origin in `ALLOWED_ORIGINS`.
5. The build embeds sharing and browser telemetry settings in `runtime-config.js`; the browser does not call `/api/config`.

References:

- [Azure Static Web Apps hosting plans](https://learn.microsoft.com/azure/static-web-apps/plans)
- [Azure Static Web Apps API overview](https://learn.microsoft.com/azure/static-web-apps/apis-overview)
- [Azure Container Apps backend integration](https://learn.microsoft.com/azure/static-web-apps/apis-container-apps)

## Architecture

```text
┌──────────────┐      ┌──────────────────────────────┐
│   Browser    │─────▶│ Azure Static Web Apps Free   │
│              │      │ HTML, JS, CSS, images, CDN   │
└──────┬───────┘      └──────────────────────────────┘
       │
       │ Direct HTTPS API calls
       │ Origin checked by Express CORS
       ▼
┌──────────────────────────────┐
│ Azure Container Apps         │
│ Express /api/* backend       │
└───────────┬──────────────────┘
            ├───────────────▶ GitHub API
            └───────────────▶ Azure Files (shared reports)
```

No Azure Functions or SWA linked backend is provisioned.

## Frontend Artifact

`npm run build:frontend` creates `webapp/frontend/dist/` without external build dependencies.

The build:

- renders the HTML metadata placeholders using `SITE_ORIGIN`
- copies JavaScript, CSS, and branded assets
- creates root favicon and social-card aliases
- generates `robots.txt`, `sitemap.xml`, and `site.webmanifest`
- validates and copies `staticwebapp.config.json`
- writes `runtime-config.js` using `FRONTEND_API_ORIGIN`, `ENABLE_SHARING`, and `PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING`
- embeds all browser configuration at build time; no configuration API request is required
- fails if template placeholders remain unresolved

The generated `dist/` directory is ignored by Git and uploaded directly by the SWA deployment action.

## Static Web Apps Routing

`webapp/frontend/staticwebapp.config.json` provides:

- SPA navigation fallback to `/index.html`
- `/_webmcp_` rewrites to `/webmcp.html`
- shared-report fallback with `X-Robots-Tag: noindex, nofollow, noarchive`
- a redirect from `/manifest.webmanifest` to `/site.webmanifest`
- short caching for unhashed source assets and longer caching for brand assets
- security headers and a CSP that permits ACA and Application Insights connections

Because the Free plan cannot proxy HTML to ACA, production pages use static homepage metadata. Client-side repository and shared-report routes continue to work, but they no longer receive route-specific server-rendered Open Graph metadata. Moving to SWA Standard with a linked backend, or adding a separate edge-rendering service, would be required to restore that behavior.

## Backend Runtime

The root `Dockerfile` now copies only backend code and the shared core package. Local source-checkout development can still set `FRONTEND_PATH`, but the ACA production image is API-only.

Backend CORS accepts:

- `ALLOWED_ORIGINS`: comma-separated exact HTTP(S) origins

Bicep always includes the generated SWA default origin. It also includes origins derived from `siteOrigin` and `staticWebAppCustomDomainName`, so a validated custom hostname remains usable even if `SITE_ORIGIN` is temporarily omitted.

## Azure Infrastructure

`infra/main.bicep` provisions:

- `Microsoft.Web/staticSites` with `Free` SKU
- the existing Container Apps environment and backend app
- optional `Microsoft.Web/staticSites/customDomains` when `staticWebAppCustomDomainName` is supplied
- existing storage, Application Insights, workbook, and availability monitoring resources

`staticWebAppLocation` defaults to `eastus2` instead of inheriting the resource-group location because SWA supports fewer regions than ACA.

Important outputs:

| Output | Purpose |
| --- | --- |
| `staticWebAppUrl` | Default SWA URL used for deployment smoke tests |
| `staticWebAppName` | SWA resource name |
| `staticWebAppResourceId` | Used to request the deployment token |
| `backendUrl` | ACA origin embedded in the frontend artifact |
| `appUrl` | Configured public frontend origin, or the default SWA URL |

The legacy ACA custom-domain parameters and certificates were removed after traffic was confirmed on SWA.

## CI/CD Flow

The production workflow:

1. builds and scans the backend image
2. deploys Bicep and the ACA revision through Azure OIDC
3. resolves the public Application Insights connection string and builds the static frontend with the deployed `backendUrl` and feature settings
4. requests the SWA deployment token through Azure Resource Manager
5. uploads `webapp/frontend/dist/` with `Azure/static-web-apps-deploy`
6. verifies backend health, frontend HTML, runtime configuration, CORS preflight, WebMCP routing, and static brand assets

CI independently runs frontend tests, builds the SWA artifact, runs backend tests, and scans the backend image.

The Azure OIDC deployment identity needs `Microsoft.Web/staticSites/listSecrets/action`; the built-in Contributor role includes it.

## Custom-Domain Cutover

Use a staged cutover so the current ACA hostname remains a rollback target.

1. Deploy and validate the default `*.azurestaticapps.net` URL.
2. For an apex domain, add the SWA DNS TXT validation record. A subdomain is validated by its CNAME instead.
3. Set the `STATIC_WEB_APP_CUSTOM_DOMAIN_NAME` repository Actions variable to the hostname without a scheme, and `STATIC_WEB_APP_DOMAIN_VALIDATION_METHOD` to `dns-txt-token` (apex) or `cname-delegation` (subdomain, the default).
4. Set the `SITE_ORIGIN` Actions variable to the public HTTPS origin. Both variables take precedence over the legacy secrets of the same names.
5. Deploy again so Bicep binds the SWA custom domain.
6. Point the hostname CNAME or apex record to SWA.
7. Validate HTTPS, scans, shared reports, telemetry, and social assets.
8. Remove the legacy ACA custom-domain bindings, certificates, parameters, and secrets after the rollback window.

Do not set `STATIC_WEB_APP_CUSTOM_DOMAIN_NAME` until the domain can be validated (TXT record for an apex, DNS-only CNAME for a subdomain); Azure rejects an unvalidated domain deployment.

The production workflow also refuses to deploy the API-only backend until the custom hostname is already bound to SWA and its public `runtime-config.js` is reachable. This guard keeps the existing ACA-served frontend live during the initial DNS migration.

The WebMCP origin-trial tokens are issued for `isainative.dev` with subdomain coverage, so moving to `repo.isainative.dev` does not by itself require a different origin scope. The checked-in tokens have expired as of 18 November 2026; renewal or a browser with native/flag-enabled support is a separate prerequisite for WebMCP activation. They do not cover the default `*.azurestaticapps.net` hostname.

## Moving to repo.isainative.dev

This application is live at **https://repo.isainative.dev**; the apex and `www` serve `webmaxru/agent-ready-check`. The cutover was completed on 19 November 2026:
- `repo` is a DNS-only Cloudflare CNAME to `victorious-pebble-0d07f890f.7.azurestaticapps.net`, bound to `is-ai-native-frontend` with CNAME validation (Ready).
- The scanner's old apex and `www` bindings were released.
- The Actions variables below are set, and CD redeployed backend CORS, monitoring and frontend metadata.

The full cross-repository order, final DNS state and rollback commands are maintained in [Agent-Ready Check's publishing guide](https://github.com/webmaxru/agent-ready-check/blob/main/docs/PUBLISHING.md#domain-migration-isainativedev-and-repoisainativedev).

The procedure followed for this repository was:

1. Add a DNS-only Cloudflare CNAME `repo` to `victorious-pebble-0d07f890f.7.azurestaticapps.net`.
2. The Free SWA already has two domains. In an agreed maintenance window, release its old `www.isainative.dev` binding, then bind `repo.isainative.dev` with CNAME validation. Keep the old apex until the new hostname works.
3. Wait for the Azure binding to be `Ready` and HTTPS frontend/runtime configuration to respond.
4. Set repository Actions variables `SITE_ORIGIN=https://repo.isainative.dev`, `STATIC_WEB_APP_CUSTOM_DOMAIN_NAME=repo.isainative.dev`, and `STATIC_WEB_APP_DOMAIN_VALIDATION_METHOD=cname-delegation`.
5. Run **CD** on `main` using its manual trigger. It updates backend CORS/origin, monitoring and frontend metadata without moving or deleting saved reports.
6. Verify repository scans, a saved report and CORS on the new hostname before transferring the apex. Existing report paths remain the same; change only the hostname in shared links.

The workflow prefers these non-secret variables over the legacy `SITE_ORIGIN` and `STATIC_WEB_APP_CUSTOM_DOMAIN_NAME` secrets, which now hold the same `repo` values. The validation method defaults to `cname-delegation`. It refuses to deploy against a hostname whose Azure status is not `Ready`. For a manual deployment, `infra/main.bicepparam` carries the same production domain values.

The standalone CLI, VS Code extension and GitHub CLI extension run their scanner locally and do not require a backend endpoint change. The web and GitHub-extension social-card assets advertise the repository-scanner hostname; package publishing is not part of this infrastructure migration.

## Local Development

Same-origin development remains available:

```powershell
cd webapp/backend
npm run dev:full
```

The split topology is available through Docker Compose:

```powershell
docker compose up --build
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`

## Rollback

If a production regression occurs:

1. redeploy the previous SWA artifact for frontend regressions
2. redeploy the previous ACA image digest for API regressions

Shared-report data remains in Azure Files and is unaffected by the frontend host.
