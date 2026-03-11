const HOME_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NO_INDEX_ROBOTS = 'noindex, nofollow, noarchive';
const REPO_PATH_RE = /^\/[^/]+\/[^/]+\/?$/;
const SHARED_REPORT_RE = /^\/_\/report\/[^/]+\/?$/;

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function resolveUrl(origin, pathname) {
  if (!origin) {
    return pathname;
  }

  return new URL(pathname, `${origin}/`).toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function getRepoSlug(pathname) {
  return pathname.replace(/^\//, '').replace(/\/$/, '');
}

function createStructuredData(siteMetadata, pageMetadata) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: siteMetadata.siteName,
        url: siteMetadata.homeUrl,
        description: siteMetadata.description,
      },
      {
        '@type': 'WebApplication',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        name: siteMetadata.siteName,
        url: pageMetadata.canonicalUrl,
        description: pageMetadata.description,
      },
    ],
  };
}

export function createSiteMetadata(env = {}) {
  const siteOrigin = normalizeOrigin(env.SITE_ORIGIN || env.PUBLIC_SITE_URL || env.APP_URL || '');
  const siteName = (env.SITE_NAME || 'IsAINative').trim();
  const shortName = (env.SITE_SHORT_NAME || siteName).trim();
  const title = (env.DEFAULT_PAGE_TITLE || 'Is AI Native | Audit GitHub Repositories for AI Coding Readiness').trim();
  const description = (
    env.DEFAULT_META_DESCRIPTION ||
    'Scan public GitHub repositories for prompts, instructions, agents, skills, hooks, and MCP setup across GitHub Copilot, Claude Code, and OpenAI Codex.'
  ).trim();
  const themeColor = (env.THEME_COLOR || '#1a1c1a').trim();
  const backgroundColor = (env.BACKGROUND_COLOR || '#050805').trim();
  const twitterHandle = (env.TWITTER_HANDLE || '').trim();
  const allowIndexing = env.ALLOW_SITE_INDEXING === 'true' || (env.NODE_ENV === 'production' && env.ALLOW_SITE_INDEXING !== 'false');
  const homeUrl = resolveUrl(siteOrigin, '/');
  const socialImageUrl = resolveUrl(siteOrigin, '/social-card.svg');

  return {
    siteOrigin,
    siteName,
    shortName,
    title,
    description,
    themeColor,
    backgroundColor,
    twitterHandle,
    allowIndexing,
    homeUrl,
    socialImageUrl,
  };
}

export function buildPageMetadata(runtime, pathname = '/') {
  const siteMetadata = runtime.siteMetadata || createSiteMetadata(runtime.env);
  const isHome = pathname === '/';
  const isSharedReport = SHARED_REPORT_RE.test(pathname);
  const isRepoPath = REPO_PATH_RE.test(pathname);

  let title = siteMetadata.title;
  let description = siteMetadata.description;
  let robots = siteMetadata.allowIndexing && isHome ? HOME_ROBOTS : NO_INDEX_ROBOTS;

  if (isRepoPath) {
    const repoSlug = getRepoSlug(pathname);
    title = `${repoSlug} | ${siteMetadata.siteName}`;
    description = `Scan ${repoSlug} for AI-native readiness across GitHub Copilot, Claude Code, and OpenAI Codex.`;
  }

  if (isSharedReport) {
    title = `Shared report | ${siteMetadata.siteName}`;
    description = 'Shared AI-native readiness snapshot for a scanned GitHub repository.';
  }

  const canonicalUrl = resolveUrl(siteMetadata.siteOrigin, isHome ? '/' : pathname);
  const structuredData = createStructuredData(siteMetadata, {
    canonicalUrl,
    description,
  });

  return {
    title,
    description,
    robots,
    canonicalUrl,
    ogImageUrl: siteMetadata.socialImageUrl,
    twitterHandle: siteMetadata.twitterHandle,
    structuredData,
  };
}

export function renderIndexHtml(template, pageMetadata) {
  return template
    .replaceAll('__PAGE_TITLE__', escapeHtml(pageMetadata.title))
    .replaceAll('__PAGE_DESCRIPTION__', escapeHtml(pageMetadata.description))
    .replaceAll('__PAGE_ROBOTS__', escapeHtml(pageMetadata.robots))
    .replaceAll('__PAGE_CANONICAL__', escapeHtml(pageMetadata.canonicalUrl))
    .replaceAll('__OG_IMAGE_URL__', escapeHtml(pageMetadata.ogImageUrl))
    .replaceAll('__TWITTER_HANDLE__', escapeHtml(pageMetadata.twitterHandle))
    .replaceAll('__STRUCTURED_DATA__', escapeJsonForScript(pageMetadata.structuredData));
}

export function getRobotsTxt(runtime) {
  const siteMetadata = runtime.siteMetadata || createSiteMetadata(runtime.env);

  if (!siteMetadata.allowIndexing) {
    return 'User-agent: *\nDisallow: /\n';
  }

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /_/report/',
    `Sitemap: ${resolveUrl(siteMetadata.siteOrigin, '/sitemap.xml')}`,
    '',
  ].join('\n');
}

export function getSitemapXml(runtime) {
  const siteMetadata = runtime.siteMetadata || createSiteMetadata(runtime.env);
  const homepage = resolveUrl(siteMetadata.siteOrigin, '/');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${escapeHtml(homepage)}</loc>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
  ].join('\n');
}

export function getWebManifest(runtime) {
  const siteMetadata = runtime.siteMetadata || createSiteMetadata(runtime.env);

  return JSON.stringify(
    {
      name: siteMetadata.siteName,
      short_name: siteMetadata.shortName,
      description: siteMetadata.description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: siteMetadata.backgroundColor,
      theme_color: siteMetadata.themeColor,
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any',
        },
      ],
    },
    null,
    2
  );
}

export function getFaviconSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Is AI Native icon">',
    '  <rect width="64" height="64" rx="14" fill="#050805" />',
    '  <path d="M18 44V20h8l8 14 8-14h8v24h-6V30l-8 14h-4l-8-14v14z" fill="#8cff95" />',
    '</svg>',
  ].join('\n');
}

export function getSocialCardSvg(runtime) {
  const siteMetadata = runtime.siteMetadata || createSiteMetadata(runtime.env);
  const siteName = escapeHtml(siteMetadata.siteName);
  const description = escapeHtml(siteMetadata.description);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="Is AI Native social card">',
    '  <defs>',
    '    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">',
    '      <stop offset="0%" stop-color="#07110a" />',
    '      <stop offset="100%" stop-color="#17331f" />',
    '    </linearGradient>',
    '  </defs>',
    '  <rect width="1200" height="630" fill="url(#bg)" />',
    '  <rect x="56" y="56" width="1088" height="518" rx="28" fill="#08110a" stroke="#24472d" stroke-width="2" />',
    '  <text x="92" y="148" fill="#8cff95" font-size="30" font-family="Segoe UI, Arial, sans-serif">AI-native repository scanner</text>',
    `  <text x="92" y="272" fill="#f5fff5" font-size="84" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${siteName}</text>`,
    `  <text x="92" y="356" fill="#b8d8bc" font-size="34" font-family="Segoe UI, Arial, sans-serif">${description}</text>`,
    '  <text x="92" y="492" fill="#8cff95" font-size="28" font-family="Consolas, monospace">instructions · prompts · agents · skills · hooks · MCP</text>',
    '  <circle cx="1036" cy="166" r="72" fill="#8cff95" opacity="0.12" />',
    '  <circle cx="1088" cy="222" r="112" fill="#8cff95" opacity="0.08" />',
    '</svg>',
  ].join('\n');
}