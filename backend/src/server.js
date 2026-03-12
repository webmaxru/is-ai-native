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
import { isAppInsightsEnabled } from './services/app-insights.js';
import {
  buildPageMetadata,
  createSiteMetadata,
  getFaviconSvg,
  getRobotsTxt,
  getSitemapXml,
  getSocialCardSvg,
  getWebManifest,
  renderIndexHtml,
} from './services/site-metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function resolveContainerStartupStrategy(env = process.env) {
  return env.CONTAINER_STARTUP_STRATEGY === 'keep-warm' ? 'keep-warm' : 'scale-to-zero';
}

function resolveContainerMinReplicas(env = process.env) {
  const parsed = Number.parseInt(env.CONTAINER_MIN_REPLICAS ?? '', 10);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return resolveContainerStartupStrategy(env) === 'keep-warm' ? 1 : 0;
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
    get containerStartupStrategy() {
      return resolveContainerStartupStrategy(env);
    },
    get containerMinReplicas() {
      return resolveContainerMinReplicas(env);
    },
  };
}

export function createApp(runtime = createRuntime()) {
  const app = express();

  app.set('trust proxy', runtime.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: runtime.env.ALLOWED_ORIGIN || false }));
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
  });
  app.use(limiter);

  app.use('/api/config', express.json({ limit: '1kb' }), createConfigRouter(runtime));
  app.use('/api/scan', express.json({ limit: '10kb' }), createScanRouter(runtime));
  app.use('/api/report', express.json({ limit: '100kb' }), createReportRouter(runtime));

  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      githubTokenProvided: runtime.githubTokenProvided,
      sharingEnabled: runtime.sharingEnabled,
      appInsightsEnabled: runtime.appInsightsEnabled,
      containerStartupStrategy: runtime.containerStartupStrategy,
      containerMinReplicas: runtime.containerMinReplicas,
    })
  );

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(getRobotsTxt(runtime));
  });

  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').send(getSitemapXml(runtime));
  });

  app.get('/site.webmanifest', (_req, res) => {
    res.type('application/manifest+json').send(getWebManifest(runtime));
  });

  app.get('/favicon.svg', (_req, res) => {
    res.type('image/svg+xml').send(getFaviconSvg(runtime));
  });

  app.get('/social-card.svg', (_req, res) => {
    res.type('image/svg+xml').send(getSocialCardSvg(runtime));
  });

  app.get('/favicon.ico', (_req, res) => {
    res.redirect(302, '/favicon.svg');
  });

  if (runtime.frontendPath && runtime.frontendTemplate) {
    app.use(express.static(runtime.frontendPath, { index: false }));
    app.get(/^(?!\/api(\/|$))/, (req, res) => {
      const pageMetadata = buildPageMetadata(runtime, req.path);
      res.type('html').send(renderIndexHtml(runtime.frontendTemplate, pageMetadata));
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
  resolveContainerMinReplicas,
  resolveContainerStartupStrategy,
  resolveFrontendPath,
  resolveTrustProxyValue,
};
export default app;
