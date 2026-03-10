import { fileURLToPath } from 'node:url';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { existsSync } from 'node:fs';
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

export function createRuntime({ env = process.env, cwd = process.cwd(), baseDir = __dirname } = {}) {
  const config = loadConfig();

  return {
    config,
    env,
    cwd,
    baseDir,
    frontendPath: resolveFrontendPath(env.FRONTEND_PATH, { cwd, baseDir }),
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
  };
}

export function createApp(runtime = createRuntime()) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: runtime.env.ALLOWED_ORIGIN || false }));
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
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
    })
  );

  if (runtime.frontendPath) {
    app.use(express.static(runtime.frontendPath));
    app.get(/^(?!\/api(\/|$))/, (_req, res) =>
      res.sendFile(join(runtime.frontendPath, 'index.html'))
    );
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
    const cleanupInterval = setInterval(cleanupExpired, 60 * 60 * 1000);
    cleanupInterval.unref();
  }
}

export { app, runtime, server, resolveFrontendPath };
export default app;
