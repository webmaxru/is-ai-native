import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let memoryStore;

function isMemoryStorage() {
  return process.env.REPORTS_DIR === ':memory:';
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

async function readRecordAsync(reportPath) {
  const contents = await readFile(reportPath, 'utf8');
  return JSON.parse(contents);
}

async function deleteRecordAsync(reportPath) {
  await rm(reportPath, { force: true });
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

export async function cleanupExpired() {
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
  for (const entry of await readdir(reportsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const reportPath = join(reportsDir, entry.name);

    try {
      const reportStats = await stat(reportPath);

      // Most reports are still active; skip reopening files whose last write is newer than the TTL window.
      if (Number.isFinite(reportStats.mtimeMs) && reportStats.mtimeMs + TTL_MS > now) {
        continue;
      }

      const record = await readRecordAsync(reportPath);
      if (record?.expires_at <= now) {
        await deleteRecordAsync(reportPath);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

export function closeDb() {
  if (memoryStore) {
    memoryStore.clear();
    memoryStore = null;
  }
}
