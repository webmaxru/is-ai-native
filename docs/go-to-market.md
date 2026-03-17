# Go-to-Market Readiness

This project now covers the minimum technical discovery surface for launch:

- Route-aware HTML metadata for the homepage, repo scan routes, and shared report routes.
- Dynamic `robots.txt` and `sitemap.xml` endpoints plus a branded `site.webmanifest` that points at generated static icon assets.
- Default homepage indexing in production, with shared reports and scan-result URLs marked `noindex`.
- Canonical URLs and Open Graph / Twitter tags derived from the production site origin when configured.
- Basic JSON-LD structured data for the website and web application.

## Configure Before Launch

Set these environment variables in production so metadata resolves to the real public domain and launch positioning:

- `isainative.dev` does not need to be hardcoded in the application code.
- The current deployment already supports this through the existing GitHub Actions production secret `SITE_ORIGIN`, which is passed into Bicep and then injected into the container as the runtime `SITE_ORIGIN` environment variable.
- For your current setup, that secret should be set to `https://isainative.dev`.

| Variable | Purpose | Example |
| --- | --- | --- |
| `SITE_ORIGIN` | Canonical public origin used for sitemap, canonical tags, and share cards. Already wired from the existing production secret into Azure Container Apps. | `https://isainative.dev` |
| `SITE_NAME` | Product name shown in manifest and structured data. | `IsAINative` |
| `SITE_SHORT_NAME` | Short PWA/app label. | `IsAI` |
| `DEFAULT_PAGE_TITLE` | Homepage title tag. | `Is AI Native | Scan GitHub Repositories for AI-Native Readiness` |
| `DEFAULT_META_DESCRIPTION` | Homepage SEO description and social summary. | `Scan public GitHub repositories for AI-native readiness signals.` |
| `TWITTER_HANDLE` | Optional X/Twitter attribution for cards. | `@isainative` |
| `ALLOW_SITE_INDEXING` | Set `true` in production. Set `false` for preview environments. | `true` |

## Remaining Launch Work

These items still need product and brand input; they should be treated as blockers or near-blockers for a public launch.

## Suggested Launch Copy

These are solid default suggestions you can ship immediately:

- Title: `Is AI Native | Audit GitHub Repositories for AI Coding Readiness`
- Subtitle / hero line: `Audit any public GitHub repository for AI coding readiness across Copilot, Claude Code, and Codex.`
- Meta description: `Scan public GitHub repositories for prompts, instructions, agents, skills, hooks, and MCP setup across GitHub Copilot, Claude Code, and OpenAI Codex.`

## Brand Asset Pipeline

Brand assets are now generated from [assets/logo.svg](c:/Users/masalnik/Downloads/projects/is-ai-native/assets/logo.svg) and written into the consumer-specific folders:

- Web app: `frontend/assets/brand/` for favicon, Apple touch icon, manifest PNGs, maskable icon, and social card files.
- GitHub CLI extension export: `packages/cli/gh-extension/assets/brand/` for the generated repo README and future repo branding.
- VS Code extension: `packages/vscode-extension/media/icon.png` for Marketplace packaging.

Rebuild the full set with:

```powershell
npm run build:brand-assets
```

The backend manifest and metadata now point at those generated static files, while the legacy `/favicon.svg`, `/favicon.ico`, and `/social-card.svg` routes remain as compatibility redirects.

## Minimal Mandatory Launch Set

For a minimal public launch, this is the smallest set I would consider mandatory:

- A privacy policy page.
- A terms of use page.
- A public contact method. Your footer name and LinkedIn are acceptable as the minimum contact surface for now.
- A short note that shared report URLs are public. This is now exposed in the share-button popover and in the shared snapshot banner.
- Search Console and Bing Webmaster Tools submission once the production domain is live.

Optional but strongly recommended shortly after launch:

- Basic product analytics.
- Uptime monitoring / alerting.
- A short methodology or FAQ page.

### Brand Assets

- Final logo pack: SVG logo, square icon, monochrome variant.
- Final social share card artwork if the generated card needs a later marketing refresh.
- Safari pinned-tab specific monochrome asset if that channel becomes important.

### Legal And Trust

- Privacy policy URL.
- Terms of use URL.
- Cookie disclosure only if you add analytics, remarketing, or other non-essential cookies.
- Your current footer attribution is acceptable as the minimum public contact surface.

### Growth And Measurement

- Search Console and Bing Webmaster Tools verification.
- Product analytics choice and event plan.
- Error monitoring / uptime alert destination.
- Conversion definition: what counts as activation, retention, and successful share.

### Content And SEO

- Final homepage copy with a sharper value proposition and target audience.
- Indexable supporting pages: FAQ, methodology, docs landing page, changelog, pricing/waitlist if relevant.
- Launch keywords and comparison pages if organic discovery matters.
- Real screenshots or explainer graphics for social and press usage.

### Technical Validation

- Run Lighthouse on the production hostname and fix any material SEO, accessibility, or performance regressions.
- Verify the deployed HTML shows the expected canonical URL, robots directive, and OG tags.
- Submit the live sitemap after the domain is final.
- Confirm non-production environments set `ALLOW_SITE_INDEXING=false`.

## Remaining Inputs From You

To finish the next pass cleanly, I still need only these materials:

1. Whether you want to keep the generated social card copy as-is or replace it with launch-specific marketing copy.
2. Whether you want a Safari pinned-tab specific monochrome mark in the next pass.
3. Whether you are adding analytics before launch, which determines whether a cookie disclosure is needed immediately.