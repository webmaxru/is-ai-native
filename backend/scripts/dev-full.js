import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

process.env.FRONTEND_PATH ??= resolve(__dirname, '../../frontend');

await import('../src/server.js');