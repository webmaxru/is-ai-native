import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import scanRouter from './routes/scan.js';
import reportRouter from './routes/report.js';
import configRouter from './routes/config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { loadConfig } from './services/config-loader.js';
import { cleanupExpired } from './services/storage.js';
import { isAppInsightsEnabled } from './services/app-insights.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate configuration at startup
try {
  const config = loadConfig();
  console.log(
    `Config loaded: ${config.primitives.length} primitives, ${config.assistants.length} assistants`
  );
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

if (!process.env.GH_TOKEN_FOR_SCAN) {
  console.warn('Warning: GH_TOKEN_FOR_SCAN not set — using unauthenticated GitHub API (60 req/hour)');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false }));
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/api/config', express.json({ limit: '1kb' }), configRouter);
app.use('/api/scan', express.json({ limit: '10kb' }), scanRouter);
// Report sharing payloads include full scan results, so allow a larger limit
app.use('/api/report', express.json({ limit: '100kb' }), reportRouter);

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    githubTokenProvided: !!process.env.GH_TOKEN_FOR_SCAN,
    sharingEnabled: process.env.ENABLE_SHARING === 'true',
    appInsightsEnabled: isAppInsightsEnabled(),
  })
);

// Serve frontend static files when SERVE_FRONTEND=true (used in production container)
if (process.env.SERVE_FRONTEND === 'true') {
  const frontendPath = process.env.FRONTEND_PATH || join(__dirname, '../frontend');
  if (existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get(/^(?!\/api(\/|$))/, (_req, res) =>
      res.sendFile(join(frontendPath, 'index.html'))
    );
  }
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

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

  if (process.env.ENABLE_SHARING === 'true') {
    const cleanupInterval = setInterval(cleanupExpired, 60 * 60 * 1000);
    cleanupInterval.unref();
  }
}

export { app, server };
export default app;
