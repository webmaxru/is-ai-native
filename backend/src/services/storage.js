import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let db;

export function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || './data/reports.db';
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        repo_url TEXT,
        result TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }
  return db;
}

export function saveReport(scanResult) {
  const id = randomUUID();
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  getDb()
    .prepare(
      'INSERT INTO reports (id, repo_url, result, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, scanResult.repo_url ?? null, JSON.stringify(scanResult), now, expiresAt);
  return id;
}

export function getReport(id) {
  const row = getDb()
    .prepare('SELECT result, expires_at FROM reports WHERE id = ?')
    .get(id);
  if (!row) return null;
  if (Date.now() > row.expires_at) {
    getDb().prepare('DELETE FROM reports WHERE id = ?').run(id);
    return null;
  }
  return JSON.parse(row.result);
}

export function cleanupExpired() {
  getDb().prepare('DELETE FROM reports WHERE expires_at < ?').run(Date.now());
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
