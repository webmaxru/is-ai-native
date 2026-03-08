import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveReport, getReport, cleanupExpired, closeDb } from '../../src/services/storage.js';

let reportsDir;

beforeEach(() => {
  reportsDir = mkdtempSync(join(tmpdir(), 'is-ai-native-storage-'));
  process.env.REPORTS_DIR = reportsDir;
  delete process.env.DB_PATH;
});

afterEach(() => {
  closeDb();
  delete process.env.REPORTS_DIR;
  delete process.env.DB_PATH;
  rmSync(reportsDir, { recursive: true, force: true });
});

const sampleResult = {
  repo_url: 'https://github.com/owner/repo',
  repo_name: 'owner/repo',
  score: 75,
  verdict: 'AI-Native',
  scanned_at: '2026-01-01T00:00:00.000Z',
  primitives: [{ name: 'Instruction Files', category: 'instructions', detected: true, matched_files: [], description: '', doc_links: [] }],
  per_assistant: [{ id: 'github-copilot', name: 'GitHub Copilot', score: 100, primitives: [] }],
};

describe('saveReport', () => {
  it('returns a UUID', () => {
    const id = saveReport(sampleResult);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('stores the result so getReport can retrieve it', () => {
    const id = saveReport(sampleResult);
    const retrieved = getReport(id);
    expect(retrieved).toEqual(sampleResult);
  });
});

describe('getReport', () => {
  it('returns null for an unknown id', () => {
    const result = getReport('00000000-0000-4000-8000-000000000000');
    expect(result).toBeNull();
  });

  it('returns null and deletes an expired report', () => {
    const id = saveReport(sampleResult);

    const reportPath = join(reportsDir, `${id}.json`);
    const record = JSON.parse(readFileSync(reportPath, 'utf8'));
    record.expires_at = 0;
    writeFileSync(reportPath, JSON.stringify(record), 'utf8');

    const result = getReport(id);
    expect(result).toBeNull();
    expect(() => readFileSync(reportPath, 'utf8')).toThrow();
  });
});

describe('cleanupExpired', () => {
  it('removes expired reports and keeps active ones', () => {
    const id1 = saveReport(sampleResult);
    const id2 = saveReport({ ...sampleResult, score: 10 });

    const reportPath = join(reportsDir, `${id1}.json`);
    const record = JSON.parse(readFileSync(reportPath, 'utf8'));
    record.expires_at = 0;
    writeFileSync(reportPath, JSON.stringify(record), 'utf8');

    cleanupExpired();
    expect(getReport(id2)).not.toBeNull();
    expect(() => readFileSync(reportPath, 'utf8')).toThrow();
  });

  it('uses in-memory storage when DB_PATH is :memory:', () => {
    delete process.env.REPORTS_DIR;
    process.env.DB_PATH = ':memory:';

    const id = saveReport(sampleResult);
    expect(getReport(id)).toEqual(sampleResult);
  });

  it('derives a writable storage directory from legacy DB_PATH values', () => {
    delete process.env.REPORTS_DIR;
    process.env.DB_PATH = join(reportsDir, 'reports.db');

    const id = saveReport(sampleResult);
    const derivedPath = join(reportsDir, 'reports-store', `${id}.json`);

    expect(JSON.parse(readFileSync(derivedPath, 'utf8')).result).toEqual(sampleResult);
  });
});
