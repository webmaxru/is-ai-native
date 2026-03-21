import { fileURLToPath } from 'node:url';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createScanRouter } from './routes/scan.js';
import { createReportRouter } from './routes/report.js';
import { createConfigRouter } from './routes/config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { loadConfig } from './services/config-loader.js';
import { cleanupExpired } from './services/storage.js';
import { isAppInsightsEnabled, parseConnectionString, trackRateLimitHit } from './services/app-insights.js';
import {
  buildPageMetadata,
  createSiteMetadata,
  getRobotsTxt,
  getSitemapXml,
  getWebManifest,
  renderIndexHtml,
} from './services/site-metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATIC_ASSET_ALIASES = new Map([
  ['/favicon.ico', 'assets/brand/favicon.ico'],
  ['/favicon.svg', 'assets/brand/favicon.svg'],
  ['/favicon-16x16.png', 'assets/brand/favicon-16.png'],
  ['/favicon-32x32.png', 'assets/brand/favicon-32.png'],
  ['/apple-touch-icon.png', 'assets/brand/apple-touch-icon.png'],
  ['/android-chrome-192x192.png', 'assets/brand/icon-192.png'],
  ['/android-chrome-512x512.png', 'assets/brand/icon-512.png'],
  ['/maskable-icon-512x512.png', 'assets/brand/icon-maskable-512.png'],
  ['/mask-icon.svg', 'assets/brand/pinned-tab.svg'],
  ['/mstile-150x150.png', 'assets/brand/mstile-150.png'],
  ['/social-card.png', 'assets/brand/social-card.png'],
  ['/social-card.svg', 'assets/brand/social-card.svg'],
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FRONTEND_GRAPHIC_EXTENSIONS = new Set(['.png', '.svg', '.ico', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);
const DEFAULT_SCAN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_SCAN_RATE_LIMIT_MAX = 120;
const DEFAULT_REPORT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_REPORT_RATE_LIMIT_MAX = 240;

function isFrontendGraphicAssetPath(assetPath = '') {
  const normalizedAssetPath = String(assetPath).toLowerCase();
  return [...FRONTEND_GRAPHIC_EXTENSIONS].some((extension) => normalizedAssetPath.endsWith(extension));
}

function applyFrontendGraphicHeaders(res, assetPath) {
  if (isFrontendGraphicAssetPath(assetPath)) {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}

function sendFrontendAsset(runtime, res, assetPath) {
  if (!runtime.frontendPath) {
    res.sendStatus(404);
    return;
  }

  const absoluteAssetPath = join(runtime.frontendPath, assetPath);
  if (!existsSync(absoluteAssetPath)) {
    res.sendStatus(404);
    return;
  }

  applyFrontendGraphicHeaders(res, assetPath);
  res.set('Cache-Control', 'public, max-age=86400').sendFile(absoluteAssetPath);
}

function resolveFrontendPath(
  frontendPathOverride = process.env.FRONTEND_PATH,
  { cwd = process.cwd(), baseDir = __dirname } = {}
) {
  const sourceCheckoutRoot = resolve(baseDir, '../..');
  const bundledAppRoot = resolve(baseDir, '..');
  const defaultCandidates = [
    join(sourceCheckoutRoot, 'frontend'),
    join(bundledAppRoot, 'frontend'),
  ];
  const candidates = frontendPathOverride
    ? [
        frontendPathOverride,
        resolve(cwd, frontendPathOverride),
        resolve(sourceCheckoutRoot, frontendPathOverride),
        resolve(bundledAppRoot, frontendPathOverride),
        ...defaultCandidates,
      ]
    : defaultCandidates;

  for (const candidate of candidates) {
    const absolutePath = isAbsolute(candidate) ? candidate : resolve(cwd, candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function loadFrontendTemplate(frontendPath) {
  if (!frontendPath) {
    return null;
  }

  try {
    return readFileSync(join(frontendPath, 'index.html'), 'utf-8');
  } catch {
    return null;
  }
}

function resolveTrustProxyValue(env = process.env) {
  const configured = env.TRUST_PROXY;

  if (configured == null || configured === '') {
    return env.NODE_ENV === 'production' ? 1 : false;
  }

  const normalized = String(configured).trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  const numeric = Number.parseInt(normalized, 10);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }

  return configured;
}

function resolvePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function resolveRateLimitPolicy(env = process.env, { windowMsKey, maxKey, defaultWindowMs, defaultMax }) {
  return {
    windowMs: resolvePositiveInteger(env[windowMsKey], defaultWindowMs),
    max: resolvePositiveInteger(env[maxKey], defaultMax),
  };
}

function buildRetryAfterSeconds(rateLimitState, windowMs) {
  const resetTime = rateLimitState?.resetTime;
  if (resetTime instanceof Date) {
    const durationMs = resetTime.getTime() - Date.now();
    if (durationMs > 0) {
      return Math.ceil(durationMs / 1000);
    }
  }

  return Math.ceil(windowMs / 1000);
}

function createRateLimitHandler({ policyName, route, windowMs }) {
  return (req, res, _next, options) => {
    const retryAfterSeconds = buildRetryAfterSeconds(req.rateLimit, windowMs);

    res.set('Retry-After', String(retryAfterSeconds));
    console.warn(
      `Rate limit hit for ${policyName}: ${req.method} ${route} from ${req.ip} (limit=${req.rateLimit?.limit ?? options.max})`
    );
    void trackRateLimitHit({
      policyName,
      route,
      method: req.method,
      ip: req.ip,
      limit: req.rateLimit?.limit ?? options.max,
      remaining: req.rateLimit?.remaining,
      retryAfterSeconds,
      windowMs,
    });

    return res.status(options.statusCode).send(options.message);
  };
}

function createApiRateLimiter({ policyName, route, windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.',
    skip: (req) => SAFE_METHODS.has(req.method),
    handler: createRateLimitHandler({ policyName, route, windowMs }),
  });
}

export function buildContentSecurityPolicyDirectives(runtime) {
  const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
  const appInsightsSettings = parseConnectionString(runtime.appInsightsWebConnectionString);

  if (runtime.env.NODE_ENV !== 'production') {
    delete directives.upgradeInsecureRequests;
  }

  if (!appInsightsSettings?.ingestionEndpoint) {
    return directives;
  }

  const connectSrc = Array.isArray(directives.connectSrc) ? [...directives.connectSrc] : ["'self'"];
  if (!connectSrc.includes(appInsightsSettings.ingestionEndpoint)) {
    connectSrc.push(appInsightsSettings.ingestionEndpoint);
  }

  directives.connectSrc = connectSrc;
  return directives;
}

export function createCleanupScheduler({
  cleanup = cleanupExpired,
  intervalMs = 60 * 60 * 1000,
  logger = console,
} = {}) {
  let activeCleanup = null;

  const runCleanup = () => {
    if (activeCleanup) {
      logger.warn('Skipping expired report cleanup because a previous run is still in progress');
      return activeCleanup;
    }

    const startedAt = Date.now();
    activeCleanup = Promise.resolve()
      .then(() => cleanup())
      .then((result) => {
        const durationMs = Date.now() - startedAt;
        if (durationMs >= 5_000) {
          logger.warn(`Expired report cleanup took ${durationMs}ms`);
        }
        return result;
      })
      .catch((err) => {
        logger.warn(`Expired report cleanup failed: ${err.message}`);
        return null;
      })
      .finally(() => {
        activeCleanup = null;
      });

    return activeCleanup;
  };

  const interval = setInterval(() => {
    void runCleanup();
  }, intervalMs);
  interval.unref?.();

  return { interval, runCleanup };
}

export function createRuntime({ env = process.env, cwd = process.cwd(), baseDir = __dirname } = {}) {
  const config = loadConfig();
  const frontendPath = resolveFrontendPath(env.FRONTEND_PATH, { cwd, baseDir });

  return {
    config,
    env,
    cwd,
    baseDir,
    trustProxy: resolveTrustProxyValue(env),
    frontendPath,
    frontendTemplate: loadFrontendTemplate(frontendPath),
    siteMetadata: createSiteMetadata(env),
    get githubToken() {
      return env.GH_TOKEN_FOR_SCAN || '';
    },
    get githubTokenProvided() {
      return !!env.GH_TOKEN_FOR_SCAN;
    },
    get sharingEnabled() {
      return env.ENABLE_SHARING === 'true';
    },
    get appInsightsEnabled() {
      return isAppInsightsEnabled();
    },
    get appInsightsWebConnectionString() {
      return env.PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING || env.APPLICATIONINSIGHTS_CONNECTION_STRING || '';
    },
    get scanRateLimit() {
      return resolveRateLimitPolicy(env, {
        windowMsKey: 'SCAN_RATE_LIMIT_WINDOW_MS',
        maxKey: 'SCAN_RATE_LIMIT_MAX',
        defaultWindowMs: DEFAULT_SCAN_RATE_LIMIT_WINDOW_MS,
        defaultMax: DEFAULT_SCAN_RATE_LIMIT_MAX,
      });
    },
    get reportRateLimit() {
      return resolveRateLimitPolicy(env, {
        windowMsKey: 'REPORT_RATE_LIMIT_WINDOW_MS',
        maxKey: 'REPORT_RATE_LIMIT_MAX',
        defaultWindowMs: DEFAULT_REPORT_RATE_LIMIT_WINDOW_MS,
        defaultMax: DEFAULT_REPORT_RATE_LIMIT_MAX,
      });
    },
  };
}

export function createApp(runtime = createRuntime()) {
  const app = express();
  const scanLimiter = createApiRateLimiter({
    policyName: 'scan_api',
    route: '/api/scan',
    windowMs: runtime.scanRateLimit.windowMs,
    max: runtime.scanRateLimit.max,
  });
  const reportLimiter = createApiRateLimiter({
    policyName: 'report_api',
    route: '/api/report',
    windowMs: runtime.reportRateLimit.windowMs,
    max: runtime.reportRateLimit.max,
  });

  app.set('trust proxy', runtime.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: buildContentSecurityPolicyDirectives(runtime),
      },
    })
  );
  app.use(cors({ origin: runtime.env.ALLOWED_ORIGIN || false }));

  app.use('/api/config', express.json({ limit: '1kb' }), createConfigRouter(runtime));
  app.use('/api/scan', scanLimiter, express.json({ limit: '10kb' }), createScanRouter(runtime));
  app.use('/api/report', reportLimiter, express.json({ limit: '100kb' }), createReportRouter(runtime));

  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      githubTokenProvided: runtime.githubTokenProvided,
      sharingEnabled: runtime.sharingEnabled,
      appInsightsEnabled: runtime.appInsightsEnabled,
    })
  );

  app.get('/robots.txt', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(getRobotsTxt(runtime));
  });

  app.get('/sitemap.xml', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(getSitemapXml(runtime));
  });

  app.get('/site.webmanifest', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').type('application/manifest+json').send(getWebManifest(runtime));
  });

  app.get('/manifest.webmanifest', (_req, res) => {
    res.redirect(302, '/site.webmanifest');
  });

  for (const [aliasPath, targetPath] of STATIC_ASSET_ALIASES) {
    app.get(aliasPath, (_req, res) => {
      sendFrontendAsset(runtime, res, targetPath);
    });
  }

  if (runtime.frontendPath && runtime.frontendTemplate) {
    app.use(
      express.static(runtime.frontendPath, {
        index: false,
        setHeaders: (res, filePath) => {
          applyFrontendGraphicHeaders(res, filePath);
        },
      })
    );
    app.get(/^(?!\/api(\/|$))/, (req, res) => {
      const pageMetadata = buildPageMetadata(runtime, req.path);
      res
        .set('X-Robots-Tag', pageMetadata.robots)
        .type('html')
        .send(renderIndexHtml(runtime.frontendTemplate, pageMetadata));
    });
  } else if (runtime.env.NODE_ENV === 'production') {
    console.warn('Frontend assets were not found; non-API routes will return JSON 404 responses');
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

let runtime;
try {
  runtime = createRuntime();
  console.log(
    `Config loaded: ${runtime.config.primitives.length} primitives, ${runtime.config.assistants.length} assistants`
  );
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

if (!runtime.githubTokenProvided) {
  console.warn('Warning: GH_TOKEN_FOR_SCAN not set — using unauthenticated GitHub API (60 req/hour)');
}

const app = createApp(runtime);
const PORT = process.env.PORT || 3000;

let server;
let cleanupScheduler;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    if (server) server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  if (runtime.sharingEnabled) {
    cleanupScheduler = createCleanupScheduler();
  }
}

export {
  app,
  runtime,
  server,
  cleanupScheduler,
  resolveFrontendPath,
  resolveRateLimitPolicy,
  resolveTrustProxyValue,
};
export default app;
