import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import scanRouter from './routes/scan.js';
import reportRouter from './routes/report.js';
import configRouter from './routes/config.js';
import { cleanupExpired } from './services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/api/config', configRouter);
app.use('/api/scan', scanRouter);
app.use('/api/report', reportRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Serve frontend static files when SERVE_FRONTEND=true (used in production container)
if (process.env.SERVE_FRONTEND === 'true') {
  const frontendPath = process.env.FRONTEND_PATH || join(__dirname, '../frontend');
  if (existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    // SPA fallback — serve index.html for all unmatched GET requests
    app.get('*', (_req, res) => res.sendFile(join(frontendPath, 'index.html')));
  }
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  if (process.env.ENABLE_SHARING === 'true') {
    const cleanupInterval = setInterval(cleanupExpired, 60 * 60 * 1000);
    cleanupInterval.unref();
  }
}

export { app, server };
export default app;
