import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';

const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let memoryStore;

function isMemoryStorage() {
  return process.env.DB_PATH === ':memory:';
}

function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = new Map();
  }

  return memoryStore;
}

function getReportsDir() {
  if (process.env.REPORTS_DIR) {
    return process.env.REPORTS_DIR;
  }

  const dbPath = process.env.DB_PATH;
  if (dbPath && dbPath !== ':memory:') {
    const parsed = parse(dbPath);
    return join(parsed.dir || '.', parsed.name ? `${parsed.name}-store` : 'reports');
  }

  return './data/reports';
}

function ensureReportsDir() {
  const reportsDir = getReportsDir();
  mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
}

function getReportPath(id) {
  return join(ensureReportsDir(), `${id}.json`);
}

function writeRecord(id, record) {
  const reportPath = getReportPath(id);
  const tempPath = `${reportPath}.tmp`;

  writeFileSync(tempPath, JSON.stringify(record), 'utf8');
  renameSync(tempPath, reportPath);
}

function readRecord(id) {
  try {
    return JSON.parse(readFileSync(getReportPath(id), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }

    throw err;
  }
}

function deleteRecord(id) {
  try {
    rmSync(getReportPath(id), { force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

export function saveReport(scanResult) {
  const id = randomUUID();
  const now = Date.now();
  const expiresAt = now + TTL_MS;

  const record = {
    id,
    repo_url: scanResult.repo_url ?? null,
    result: scanResult,
    created_at: now,
    expires_at: expiresAt,
  };

  if (isMemoryStorage()) {
    getMemoryStore().set(id, record);
    return id;
  }

  writeRecord(id, record);
  return id;
}

export function getReport(id) {
  const record = isMemoryStorage() ? getMemoryStore().get(id) ?? null : readRecord(id);
  if (!record) return null;

  if (Date.now() >= record.expires_at) {
    if (isMemoryStorage()) {
      getMemoryStore().delete(id);
    } else {
      deleteRecord(id);
    }
    return null;
  }

  return record.result;
}

export function cleanupExpired() {
  const now = Date.now();

  if (isMemoryStorage()) {
    for (const [id, record] of getMemoryStore().entries()) {
      if (record.expires_at <= now) {
        getMemoryStore().delete(id);
      }
    }
    return;
  }

  const reportsDir = ensureReportsDir();
  for (const entry of readdirSync(reportsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const id = entry.name.slice(0, -5);
    const record = readRecord(id);
    if (record && record.expires_at <= now) {
      deleteRecord(id);
    }
  }
}

export function closeDb() {
  if (memoryStore) {
    memoryStore.clear();
    memoryStore = null;
  }
}
