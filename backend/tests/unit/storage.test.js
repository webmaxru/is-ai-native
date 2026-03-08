import { saveReport, getReport, cleanupExpired, closeDb, getDb } from '../../src/services/storage.js';

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:';

afterEach(() => {
  closeDb();
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
    // Manually expire the row
    getDb().prepare('UPDATE reports SET expires_at = 0 WHERE id = ?').run(id);
    const result = getReport(id);
    expect(result).toBeNull();
    // Row should be deleted
    const row = getDb().prepare('SELECT id FROM reports WHERE id = ?').get(id);
    expect(row).toBeUndefined();
  });
});

describe('cleanupExpired', () => {
  it('removes expired reports and keeps active ones', () => {
    const id1 = saveReport(sampleResult);
    const id2 = saveReport({ ...sampleResult, score: 10 });
    getDb().prepare('UPDATE reports SET expires_at = 0 WHERE id = ?').run(id1);
    cleanupExpired();
    expect(getReport(id2)).not.toBeNull();
    const row = getDb().prepare('SELECT id FROM reports WHERE id = ?').get(id1);
    expect(row).toBeUndefined();
  });
});
