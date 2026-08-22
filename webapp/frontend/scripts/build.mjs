import { cp, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT_DIR = join(FRONTEND_ROOT, 'dist');
const DEFAULT_SITE_ORIGIN = 'http://localhost:8080';
const DEFAULT_TITLE = 'Is AI Native | Audit GitHub Repositories for AI Coding Readiness';
const DEFAULT_DESCRIPTION =
  'Scan public GitHub repositories for prompts, instructions, agents, skills, hooks, and MCP setup across GitHub Copilot, Claude Code, and OpenAI Codex.';

const ASSET_ALIASES = new Map([
  ['favicon.ico', 'favicon.ico'],
  ['favicon.svg', 'favicon.svg'],
  ['favicon-16x16.png', 'favicon-16.png'],
  ['favicon-32x32.png', 'favicon-32.png'],
  ['apple-touch-icon.png', 'apple-touch-icon.png'],
  ['android-chrome-192x192.png', 'icon-192.png'],
  ['android-chrome-512x512.png', 'icon-512.png'],
  ['maskable-icon-512x512.png', 'icon-maskable-512.png'],
  ['mask-icon.svg', 'pinned-tab.svg'],
  ['mstile-150x150.png', 'mstile-150.png'],
  ['social-card.png', 'social-card.png'],
  ['social-card.svg', 'social-card.svg'],
]);

function normalizeOrigin(value, label, { allowEmpty = false } = {}) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed && allowEmpty) {
    return '';
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) origin`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${label} must be an absolute HTTP(S) origin`);
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must not include a path, query, or fragment`);
  }

  return url.origin;
}

function normalizeBoolean(value, label) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === '' || normalized === 'false') {
    return false;
  }

  if (normalized === 'true') {
    return true;
  }

  throw new Error(`${label} must be true or false`);
}

function normalizeOptionalString(value, label) {
  if (value == null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string`);
  }

  return value.trim();
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

function buildStructuredData({ canonicalUrl, description, imageUrl, siteName, title }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${canonicalUrl}#website`,
        name: siteName,
        url: canonicalUrl,
        description,
        image: imageUrl,
        inLanguage: 'en',
      },
      {
        '@type': 'WebApplication',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        name: title,
        url: canonicalUrl,
        description,
        image: imageUrl,
        inLanguage: 'en',
      },
    ],
  };
}

function createPageMetadata(siteOrigin, overrides = {}) {
  const pathname = overrides.pathname || '/';
  const canonicalUrl = new URL(pathname, `${siteOrigin}/`).toString();
  const title = overrides.title || DEFAULT_TITLE;
  const description = overrides.description || DEFAULT_DESCRIPTION;
  const siteName = 'Is AI Native';
  const imageUrl = new URL('/social-card.png', `${siteOrigin}/`).toString();

  return {
    title,
    description,
    robots:
      overrides.robots ||
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    canonicalUrl,
    siteName,
    shortName: siteName,
    siteLocale: 'en_US',
    imageUrl,
    socialImageAlt: `${siteName} social card`,
    themeColor: '#1a1c1a',
    backgroundColor: '#050805',
    maskIconColor: '#1a7a2e',
    twitterHandle: '@webmaxru',
    structuredData: buildStructuredData({
      canonicalUrl,
      description,
      imageUrl,
      siteName,
      title,
    }),
  };
}

function renderTemplate(template, metadata) {
  const replacements = new Map([
    ['__PAGE_TITLE__', metadata.title],
    ['__PAGE_DESCRIPTION__', metadata.description],
    ['__PAGE_ROBOTS__', metadata.robots],
    ['__PAGE_CANONICAL__', metadata.canonicalUrl],
    ['__SITE_NAME__', metadata.siteName],
    ['__SITE_SHORT_NAME__', metadata.shortName],
    ['__SITE_LOCALE__', metadata.siteLocale],
    ['__OG_IMAGE_URL__', metadata.imageUrl],
    ['__SOCIAL_IMAGE_ALT__', metadata.socialImageAlt],
    ['__THEME_COLOR__', metadata.themeColor],
    ['__BACKGROUND_COLOR__', metadata.backgroundColor],
    ['__MASK_ICON_COLOR__', metadata.maskIconColor],
    ['__TWITTER_HANDLE__', metadata.twitterHandle],
  ]);

  let rendered = template;
  for (const [placeholder, value] of replacements) {
    rendered = rendered.replaceAll(placeholder, escapeHtml(value));
  }
  rendered = rendered.replaceAll('__STRUCTURED_DATA__', escapeJsonForScript(metadata.structuredData));

  const unresolved = [...new Set(rendered.match(/__[A-Z0-9_]+__/g) || [])];
  if (unresolved.length > 0) {
    throw new Error(`Unresolved frontend template placeholders: ${unresolved.join(', ')}`);
  }

  return rendered;
}

function createManifest() {
  return {
    name: 'Is AI Native',
    short_name: 'Is AI Native',
    id: '/',
    description: DEFAULT_DESCRIPTION,
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    display: 'standalone',
    orientation: 'portrait',
    categories: ['developer tools', 'productivity', 'utilities'],
    prefer_related_applications: false,
    background_color: '#050805',
    theme_color: '#1a1c1a',
    shortcuts: [
      {
        name: 'Scan a GitHub repository',
        short_name: 'Scan repo',
        description: 'Open the scanner and audit a public GitHub repository for AI-native readiness.',
        url: '/?source=app-shortcut',
      },
    ],
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    related_applications: [],
  };
}

export async function buildFrontend({
  apiOrigin = process.env.FRONTEND_API_ORIGIN || '',
  appInsightsConnectionString =
    process.env.PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING ||
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
    '',
  outputDir = process.env.FRONTEND_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
  sharingEnabled = process.env.ENABLE_SHARING || false,
  siteOrigin = process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN,
} = {}) {
  const normalizedApiOrigin = normalizeOrigin(apiOrigin, 'FRONTEND_API_ORIGIN', { allowEmpty: true });
  const normalizedAppInsightsConnectionString = normalizeOptionalString(
    appInsightsConnectionString,
    'PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING'
  );
  const normalizedSiteOrigin = normalizeOrigin(siteOrigin, 'SITE_ORIGIN');
  const normalizedSharingEnabled = normalizeBoolean(sharingEnabled, 'ENABLE_SHARING');
  const absoluteOutputDir = resolve(outputDir);
  const brandAssetsDir = join(FRONTEND_ROOT, 'assets', 'brand');

  await rm(absoluteOutputDir, { recursive: true, force: true });
  await mkdir(absoluteOutputDir, { recursive: true });
  await Promise.all([
    cp(join(FRONTEND_ROOT, 'assets'), join(absoluteOutputDir, 'assets'), { recursive: true }),
    cp(join(FRONTEND_ROOT, 'src'), join(absoluteOutputDir, 'src'), { recursive: true }),
  ]);

  const [indexTemplate, webmcpTemplate, staticWebAppConfigText] = await Promise.all([
    readFile(join(FRONTEND_ROOT, 'index.html'), 'utf8'),
    readFile(join(FRONTEND_ROOT, 'webmcp.html'), 'utf8'),
    readFile(join(FRONTEND_ROOT, 'staticwebapp.config.json'), 'utf8'),
  ]);
  const staticWebAppConfig = JSON.parse(staticWebAppConfigText);

  const homeMetadata = createPageMetadata(normalizedSiteOrigin);
  const webmcpMetadata = createPageMetadata(normalizedSiteOrigin, {
    pathname: '/_webmcp_/',
    title: 'WebMCP demo | Is AI Native',
    description:
      'Live WebMCP demo: explore the repository-scanner tools this site exposes to AI agents and learn how to test them in Chrome.',
    robots: 'noindex, nofollow, noarchive',
  });
  const runtimeConfig = `globalThis.__IS_AI_NATIVE_CONFIG__ = Object.freeze(${JSON.stringify(
    {
      apiOrigin: normalizedApiOrigin,
      sharingEnabled: normalizedSharingEnabled,
      appInsightsConnectionString: normalizedAppInsightsConnectionString,
    },
    null,
    2
  )});\n`;
  const robotsTxt = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /_/report/',
    'Disallow: /_webmcp_/',
    `Sitemap: ${new URL('/sitemap.xml', `${normalizedSiteOrigin}/`)}`,
    '',
  ].join('\n');
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${escapeHtml(new URL('/', `${normalizedSiteOrigin}/`).toString())}</loc>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');

  await Promise.all([
    writeFile(join(absoluteOutputDir, 'index.html'), renderTemplate(indexTemplate, homeMetadata)),
    writeFile(join(absoluteOutputDir, 'webmcp.html'), renderTemplate(webmcpTemplate, webmcpMetadata)),
    writeFile(join(absoluteOutputDir, 'runtime-config.js'), runtimeConfig),
    writeFile(
      join(absoluteOutputDir, 'staticwebapp.config.json'),
      `${JSON.stringify(staticWebAppConfig, null, 2)}\n`
    ),
    writeFile(join(absoluteOutputDir, 'robots.txt'), robotsTxt),
    writeFile(join(absoluteOutputDir, 'sitemap.xml'), sitemapXml),
    writeFile(
      join(absoluteOutputDir, 'site.webmanifest'),
      `${JSON.stringify(createManifest(), null, 2)}\n`
    ),
    ...[...ASSET_ALIASES].map(([destination, source]) =>
      copyFile(join(brandAssetsDir, source), join(absoluteOutputDir, destination))
    ),
  ]);

  return {
    apiOrigin: normalizedApiOrigin,
    appInsightsConnectionString: normalizedAppInsightsConnectionString,
    outputDir: absoluteOutputDir,
    sharingEnabled: normalizedSharingEnabled,
    siteOrigin: normalizedSiteOrigin,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const result = await buildFrontend();
  console.log(`Built static frontend in ${result.outputDir}`);
}
