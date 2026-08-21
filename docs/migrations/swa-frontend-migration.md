# Frontend Migration to Azure Static Web Apps

**Status:** Implemented
**Date:** 2026-08-21

## Outcome

The web application now deploys as two independent workloads:

- **Frontend:** generated static files hosted on Azure Static Web Apps Free
- **Backend:** Express API hosted on Azure Container Apps Consumption

The backend image no longer contains the SPA. Static assets are delivered by the SWA global edge network, while scans, configuration, telemetry setup, and shared-report storage remain in ACA.

## Free-Plan Constraint

Azure Static Web Apps can link an Azure Container App as a same-origin `/api` backend only on the **Standard** plan. The Free plan therefore cannot use the linked-backend design from the original proposal.

This implementation uses direct browser-to-ACA HTTPS requests instead:

1. CD deploys Bicep and reads the generated ACA URL.
2. The frontend build writes that origin to `runtime-config.js`.
3. `webapp/frontend/src/api.js` sends API requests to `<ACA origin>/api`.
4. Bicep configures ACA with the exact SWA default origin and optional public custom origin in `ALLOWED_ORIGINS`.

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
- writes `runtime-config.js` using `FRONTEND_API_ORIGIN`
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
- `ALLOWED_ORIGIN`: legacy single-origin fallback

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

The legacy ACA custom-domain parameters remain available during DNS migration and rollback. They can be cleared after traffic is confirmed on SWA.

## CI/CD Flow

The production workflow:

1. builds and scans the backend image
2. deploys Bicep and the ACA revision through Azure OIDC
3. builds the static frontend with the deployed `backendUrl`
4. requests the SWA deployment token through Azure Resource Manager
5. uploads `webapp/frontend/dist/` with `Azure/static-web-apps-deploy`
6. verifies backend health, frontend HTML, runtime configuration, CORS preflight, WebMCP routing, and static brand assets

CI independently runs frontend tests, builds the SWA artifact, runs backend tests, and scans the backend image.

The Azure OIDC deployment identity needs `Microsoft.Web/staticSites/listSecrets/action`; the built-in Contributor role includes it.

## Custom-Domain Cutover

Use a staged cutover so the current ACA hostname remains a rollback target.

1. Deploy and validate the default `*.azurestaticapps.net` URL.
2. Add the SWA DNS TXT validation record.
3. Set the `STATIC_WEB_APP_CUSTOM_DOMAIN_NAME` production secret to the hostname without a scheme.
4. Keep `SITE_ORIGIN` set to the public HTTPS origin.
5. Deploy again so Bicep binds the SWA custom domain.
6. Point the hostname CNAME or apex record to SWA.
7. Validate HTTPS, scans, shared reports, telemetry, and social assets.
8. Clear the legacy ACA custom-domain secrets after the rollback window.

Do not set `STATIC_WEB_APP_CUSTOM_DOMAIN_NAME` until the TXT validation record exists; Azure rejects an unvalidated domain deployment.

The WebMCP origin-trial tokens are issued for `isainative.dev`, so WebMCP activation must be validated on that custom domain rather than on the default `*.azurestaticapps.net` hostname.

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

If the SWA cutover fails:

1. restore DNS to the legacy ACA hostname
2. retain or restore the ACA custom-domain parameters
3. redeploy the previous backend image if a full single-container rollback is required

Shared-report data remains in Azure Files and is unaffected by the frontend host.
