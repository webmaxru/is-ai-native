/**
 * Express server entry point.
 * Configures middleware, routes, and starts the HTTP server.
 * @module server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanRouter } from './routes/scan.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { loadPrimitivesConfig, loadAssistantsConfig } from './services/config-loader.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve config directory relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = join(__dirname, 'config');

// Validate configuration at startup
try {
  loadPrimitivesConfig(join(CONFIG_DIR, 'primitives.json'));
  loadAssistantsConfig(join(CONFIG_DIR, 'assistants.json'));
} catch (err) {
  console.error('FATAL: Configuration validation failed:', err.message);
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting: 60 requests per minute per IP
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api', scanLimiter);

// Content-Type validation for POST requests
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }
  next();
});

// Trust proxy for reverse proxy setups (1 = trust first hop only)
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Welcome route
app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to the AI-Native Readiness Checker API',
    endpoints: {
      scan: 'POST /api/scan',
      health: 'GET /health',
    },
  });
});

// API routes
app.use('/api', scanRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
let server;

/**
 * Starts the HTTP server.
 * @returns {import('http').Server} The HTTP server instance
 */
export function startServer() {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (!process.env.GITHUB_TOKEN) {
      console.warn(
        'WARNING: GITHUB_TOKEN not set. Using unauthenticated GitHub API (60 req/hour limit).',
      );
    }
  });
  return server;
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  }
});

// Start server if this is the main module
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  startServer();
}

export { app };
