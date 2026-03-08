import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import scanRouter from './routes/scan.js';
import reportRouter from './routes/report.js';
import configRouter from './routes/config.js';
import { cleanupExpired } from './services/storage.js';

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
