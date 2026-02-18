import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';

// Mock the GitHub service
vi.mock('../../src/services/github.js', () => ({
  getRepoInfo: vi.fn(),
  getFileTree: vi.fn(),
}));

import { getRepoInfo, getFileTree } from '../../src/services/github.js';

describe('POST /api/scan contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    getRepoInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/repo',
    });
    getFileTree.mockResolvedValue({
      tree: [
        { path: '.github/copilot-instructions.md', type: 'blob' },
        { path: 'CLAUDE.md', type: 'blob' },
        { path: 'src/index.js', type: 'blob' },
      ],
      truncated: false,
    });
  });

  describe('request body schema', () => {
    it('should accept { url: string }', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.status).toBe(200);
    });

    it('should accept { url: string, branch: string }', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo', branch: 'develop' });

      expect(res.status).toBe(200);
    });

    it('should reject request without url field', async () => {
      const res = await request(app).post('/api/scan').send({ branch: 'main' });

      expect(res.status).toBe(400);
    });
  });

  describe('response JSON structure', () => {
    it('should return correct top-level fields', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('repoUrl');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('overallScore');
      expect(res.body).toHaveProperty('primitives');

      // Type checks
      expect(typeof res.body.repoUrl).toBe('string');
      expect(typeof res.body.timestamp).toBe('string');
      expect(typeof res.body.overallScore).toBe('number');
      expect(Array.isArray(res.body.primitives)).toBe(true);
    });

    it('should return valid ISO timestamp', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      const date = new Date(res.body.timestamp);
      expect(date.toISOString()).toBe(res.body.timestamp);
    });

    it('should return overallScore between 0 and 100', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.body.overallScore).toBeGreaterThanOrEqual(0);
      expect(res.body.overallScore).toBeLessThanOrEqual(100);
    });

    it('should return per-primitive result objects with required fields', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      res.body.primitives.forEach((primitive) => {
        expect(primitive).toHaveProperty('name');
        expect(primitive).toHaveProperty('category');
        expect(primitive).toHaveProperty('detected');
        expect(primitive).toHaveProperty('matchedFiles');
        expect(primitive).toHaveProperty('description');
        expect(primitive).toHaveProperty('docLinks');
        expect(primitive).toHaveProperty('assistants');

        // Type checks
        expect(typeof primitive.name).toBe('string');
        expect(typeof primitive.category).toBe('string');
        expect(typeof primitive.detected).toBe('boolean');
        expect(Array.isArray(primitive.matchedFiles)).toBe(true);
        expect(typeof primitive.description).toBe('string');
        expect(Array.isArray(primitive.docLinks)).toBe(true);
        expect(Array.isArray(primitive.assistants)).toBe(true);

        // Non-empty checks
        expect(primitive.name.length).toBeGreaterThan(0);
        expect(primitive.category.length).toBeGreaterThan(0);
        expect(primitive.description.length).toBeGreaterThan(0);
        expect(primitive.docLinks.length).toBeGreaterThan(0);
        expect(primitive.assistants.length).toBeGreaterThan(0);
      });
    });

    it('should return the submitted repo URL in the response', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.body.repoUrl).toBe('https://github.com/owner/repo');
    });

    it('should return perAssistant object with correct structure', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      expect(res.body).toHaveProperty('perAssistant');
      expect(typeof res.body.perAssistant).toBe('object');
      expect(res.body.perAssistant).not.toBeNull();

      // Each assistant entry should have score, detected, total
      for (const [assistantId, data] of Object.entries(res.body.perAssistant)) {
        expect(typeof assistantId).toBe('string');
        expect(data).toHaveProperty('score');
        expect(data).toHaveProperty('detected');
        expect(data).toHaveProperty('total');
        expect(typeof data.score).toBe('number');
        expect(typeof data.detected).toBe('number');
        expect(typeof data.total).toBe('number');
        expect(data.score).toBeGreaterThanOrEqual(0);
        expect(data.score).toBeLessThanOrEqual(100);
        expect(data.detected).toBeLessThanOrEqual(data.total);
      }
    });

    it('should include all known assistants in perAssistant', async () => {
      const res = await request(app)
        .post('/api/scan')
        .send({ url: 'https://github.com/owner/repo' });

      const assistantIds = Object.keys(res.body.perAssistant);
      expect(assistantIds).toContain('github-copilot');
      expect(assistantIds).toContain('claude-code');
      expect(assistantIds).toContain('openai-codex');
    });
  });

  describe('error response schema', () => {
    it('should return error object with error field', async () => {
      const res = await request(app).post('/api/scan').send({ url: 'not-a-url' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
  });
});
