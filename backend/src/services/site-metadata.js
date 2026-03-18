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
        '@id': `${siteMetadata.homeUrl}#website`,
        name: siteMetadata.siteName,
        url: siteMetadata.homeUrl,
        description: siteMetadata.description,
        image: siteMetadata.socialImageUrl,
        inLanguage: siteMetadata.siteLanguage,
      },
      {
        '@type': 'WebPage',
        name: pageMetadata.title,
        url: pageMetadata.canonicalUrl,
        description: pageMetadata.description,
        inLanguage: siteMetadata.siteLanguage,
        isPartOf: {
          '@id': `${siteMetadata.homeUrl}#website`,
        },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: siteMetadata.socialImageUrl,
        },
      },
      {
        '@type': 'WebApplication',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        name: siteMetadata.siteName,
        url: pageMetadata.canonicalUrl,
        description: pageMetadata.description,
        image: siteMetadata.socialImageUrl,
        inLanguage: siteMetadata.siteLanguage,
      },
    ],
  };
}

export function createSiteMetadata(env = {}) {
  const siteOrigin = normalizeOrigin(env.SITE_ORIGIN || env.PUBLIC_SITE_URL || env.APP_URL || '');
  const siteName = (env.SITE_NAME || 'IsAINative').trim();
  const shortName = (env.SITE_SHORT_NAME || siteName).trim();
  const siteLanguage = (env.SITE_LANGUAGE || 'en').trim();
  const siteLocale = (env.SITE_LOCALE || 'en_US').trim();
  const title = (env.DEFAULT_PAGE_TITLE || 'Is AI Native | Audit GitHub Repositories for AI Coding Readiness').trim();
  const description = (
    env.DEFAULT_META_DESCRIPTION ||
    'Scan public GitHub repositories for prompts, instructions, agents, skills, hooks, and MCP setup across GitHub Copilot, Claude Code, and OpenAI Codex.'
  ).trim();
  const themeColor = (env.THEME_COLOR || '#1a1c1a').trim();
  const backgroundColor = (env.BACKGROUND_COLOR || '#050805').trim();
  const maskIconColor = (env.MASK_ICON_COLOR || '#1a7a2e').trim();
  const twitterHandle = (env.TWITTER_HANDLE || '').trim();
  const allowIndexing = env.ALLOW_SITE_INDEXING === 'true' || (env.NODE_ENV === 'production' && env.ALLOW_SITE_INDEXING !== 'false');
  const homeUrl = resolveUrl(siteOrigin, '/');
  const socialImageUrl = resolveUrl(siteOrigin, '/social-card.png');
  const socialImageAlt = (env.SOCIAL_IMAGE_ALT || `${siteName} social card`).trim();

  return {
    siteOrigin,
    siteName,
    shortName,
    siteLanguage,
    siteLocale,
    title,
    description,
    themeColor,
    backgroundColor,
    maskIconColor,
    twitterHandle,
    allowIndexing,
    homeUrl,
    socialImageUrl,
    socialImageAlt,
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
    siteName: siteMetadata.siteName,
    shortName: siteMetadata.shortName,
    siteLocale: siteMetadata.siteLocale,
    ogImageUrl: siteMetadata.socialImageUrl,
    socialImageAlt: siteMetadata.socialImageAlt,
    themeColor: siteMetadata.themeColor,
    backgroundColor: siteMetadata.backgroundColor,
    maskIconColor: siteMetadata.maskIconColor,
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
    .replaceAll('__SITE_NAME__', escapeHtml(pageMetadata.siteName))
    .replaceAll('__SITE_SHORT_NAME__', escapeHtml(pageMetadata.shortName))
    .replaceAll('__SITE_LOCALE__', escapeHtml(pageMetadata.siteLocale))
    .replaceAll('__OG_IMAGE_URL__', escapeHtml(pageMetadata.ogImageUrl))
    .replaceAll('__SOCIAL_IMAGE_ALT__', escapeHtml(pageMetadata.socialImageAlt))
    .replaceAll('__THEME_COLOR__', escapeHtml(pageMetadata.themeColor))
    .replaceAll('__BACKGROUND_COLOR__', escapeHtml(pageMetadata.backgroundColor))
    .replaceAll('__MASK_ICON_COLOR__', escapeHtml(pageMetadata.maskIconColor))
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
      id: '/',
      description: siteMetadata.description,
      lang: siteMetadata.siteLanguage,
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display_override: ['standalone', 'minimal-ui', 'browser'],
      display: 'standalone',
      orientation: 'portrait',
      categories: ['developer tools', 'productivity', 'utilities'],
      prefer_related_applications: false,
      background_color: siteMetadata.backgroundColor,
      theme_color: siteMetadata.themeColor,
      shortcuts: [
        {
          name: 'Scan a GitHub repository',
          short_name: 'Scan repo',
          description: 'Open the scanner and audit a public GitHub repository for AI-native readiness.',
          url: '/?source=app-shortcut',
        },
      ],
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
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
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '  <defs>',
    '    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">',
    '      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur1"/>',
    '      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>',
    '      <feMerge>',
    '        <feMergeNode in="blur1"/>',
    '        <feMergeNode in="blur2"/>',
    '        <feMergeNode in="SourceGraphic"/>',
    '      </feMerge>',
    '    </filter>',
    '  </defs>',
    '  <rect width="512" height="512" rx="120" fill="#0B1017" />',
    '  <g transform="translate(42 42) scale(0.8359375)">',
    '    <rect x="70" y="180" width="372" height="40" rx="8" fill="#2B3E5B" />',
    '    <path d="M220 120c-60 0-80 40-80 80s-40 56-40 56 40 16 40 56 20 80 80 80m72-272c60 0 80 40 80 80s40 56 40 56-40 16-40 56-20 80-80 80" fill="none" stroke="#7A889E" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />',
    '    <path d="M186 145c34 0 50 25 70 25s36-25 70-25a55 55 0 0 1 55 55 55 55 0 0 1-55 55c-34 0-50-25-70-25s-36 25-70 25a55 55 0 0 1-55-55 55 55 0 0 1 55-55Z" fill="#2A3E5D" stroke="#0F172A" stroke-width="12" stroke-linejoin="round" />',
    '    <circle cx="186" cy="200" r="32" fill="#0F172A" />',
    '    <circle cx="326" cy="200" r="32" fill="#0F172A" />',
    '    <circle cx="186" cy="200" r="26" fill="#00FF41" filter="url(#glow)" />',
    '    <circle cx="326" cy="200" r="26" fill="#00FF41" filter="url(#glow)" />',
    '    <circle cx="186" cy="200" r="14" fill="#A3FFA3" />',
    '    <circle cx="326" cy="200" r="14" fill="#A3FFA3" />',
    '    <circle cx="186" cy="200" r="6" fill="#FFFFFF" />',
    '    <circle cx="326" cy="200" r="6" fill="#FFFFFF" />',
    '  </g>',
    '</svg>',
  ].join('\n');
}

export function getSocialCardSvg(runtime) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="Is AI Native social card">',
    '  <defs>',
    '    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">',
    '      <stop offset="0%" stop-color="#081017" />',
    '      <stop offset="52%" stop-color="#0D1117" />',
    '      <stop offset="100%" stop-color="#132129" />',
    '    </linearGradient>',
    '    <filter id="card-glow" x="-50%" y="-50%" width="200%" height="200%">',
    '      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur1"/>',
    '      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>',
    '      <feMerge>',
    '        <feMergeNode in="blur1"/>',
    '        <feMergeNode in="blur2"/>',
    '        <feMergeNode in="SourceGraphic"/>',
    '      </feMerge>',
    '    </filter>',
    '  </defs>',
    '  <rect width="1200" height="630" fill="url(#bg)" />',
    '  <circle cx="1080" cy="122" r="168" fill="#00FF41" opacity="0.08" />',
    '  <circle cx="986" cy="566" r="238" fill="#00FF41" opacity="0.05" />',
    '  <rect x="40" y="40" width="1120" height="550" rx="36" fill="#0A141C" stroke="#22303D" stroke-width="2" />',
    '  <text x="92" y="120" fill="#00FF41" font-size="28" font-family="Segoe UI, Arial, sans-serif" letter-spacing="1.4">Audit code repositories for AI readiness</text>',
    '  <text x="92" y="244" fill="#F5F7FA" font-size="84" font-weight="700" font-family="Segoe UI, Arial, sans-serif">Is AI-Native?</text>',
    '  <text x="92" y="314" fill="#D7E0E7" font-size="40" font-family="Segoe UI, Arial, sans-serif">Scan &gt; Review &gt; Improve</text>',
    '  <text x="92" y="392" fill="#9FB0C0" font-size="27" font-family="Segoe UI, Arial, sans-serif">Instructions, skills, custom agents, agent hooks, MCP, and more</text>',
    '  <rect x="92" y="450" width="552" height="58" rx="29" fill="#0F1A20" stroke="#2B3640" />',
    '  <text x="122" y="488" font-size="24" font-family="Consolas, monospace">',
    '    <tspan fill="#00FF41">isainative.dev</tspan><tspan fill="#7C8E9E">/&lt;repo owner&gt;/&lt;repo name&gt;</tspan>',
    '  </text>',
    '  <g transform="translate(822 96)">',
    '    <rect width="256" height="256" rx="34" fill="#0B1017" />',
    '    <g transform="translate(22 22) scale(0.4140625)">',
    '      <rect x="70" y="180" width="372" height="40" rx="8" fill="#2B3E5B" />',
    '      <path d="M220 120c-60 0-80 40-80 80s-40 56-40 56 40 16 40 56 20 80 80 80m72-272c60 0 80 40 80 80s40 56 40 56-40 16-40 56-20 80-80 80" fill="none" stroke="#7A889E" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" />',
    '      <path d="M186 145c34 0 50 25 70 25s36-25 70-25a55 55 0 0 1 55 55 55 55 0 0 1-55 55c-34 0-50-25-70-25s-36 25-70 25a55 55 0 0 1-55-55 55 55 0 0 1 55-55Z" fill="#2A3E5D" stroke="#0F172A" stroke-width="12" stroke-linejoin="round" />',
    '      <circle cx="186" cy="200" r="32" fill="#0F172A" />',
    '      <circle cx="326" cy="200" r="32" fill="#0F172A" />',
    '      <circle cx="186" cy="200" r="26" fill="#00FF41" filter="url(#card-glow)" />',
    '      <circle cx="326" cy="200" r="26" fill="#00FF41" filter="url(#card-glow)" />',
    '      <circle cx="186" cy="200" r="14" fill="#A3FFA3" />',
    '      <circle cx="326" cy="200" r="14" fill="#A3FFA3" />',
    '      <circle cx="186" cy="200" r="6" fill="#FFFFFF" />',
    '      <circle cx="326" cy="200" r="6" fill="#FFFFFF" />',
    '    </g>',
    '  </g>',
    '</svg>',
  ].join('\n');
}