import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';

// Mock the GitHub service
vi.mock('../../src/services/github.js', () => ({
  getRepoInfo: vi.fn(),
  getFileTree: vi.fn(),
}));

import { getRepoInfo, getFileTree } from '../../src/services/github.js';

describe('POST /api/scan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return a full readiness report for a valid repo', async () => {
    getRepoInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/repo',
    });
    getFileTree.mockResolvedValue({
      tree: [
        { path: '.github/copilot-instructions.md', type: 'blob' },
        { path: 'CLAUDE.md', type: 'blob' },
        { path: '.vscode/mcp.json', type: 'blob' },
        { path: 'src/index.js', type: 'blob' },
      ],
      truncated: false,
    });

    const res = await request(app).post('/api/scan').send({ url: 'https://github.com/owner/repo' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('repoUrl');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('overallScore');
    expect(res.body).toHaveProperty('primitives');
    expect(res.body.overallScore).toBeGreaterThanOrEqual(0);
    expect(res.body.overallScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(res.body.primitives)).toBe(true);
  });

  it('should return 400 for invalid URL', async () => {
    const res = await request(app).post('/api/scan').send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for missing URL', async () => {
    const res = await request(app).post('/api/scan').send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 for non-existent repo', async () => {
    const error = new Error('Repository not found. Please check the URL and try again.');
    error.statusCode = 404;
    getFileTree.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/scan')
      .send({ url: 'https://github.com/nonexistent/repo' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('not found');
  });

  it('should return 403 for private repo', async () => {
    const error = new Error('This repository is private or access is denied.');
    error.statusCode = 403;
    getFileTree.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/scan')
      .send({ url: 'https://github.com/private/repo' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('private');
  });

  it('should return 429 for rate-limited requests', async () => {
    const error = new Error('GitHub API rate limit exceeded. Try again in 5 minutes.');
    error.statusCode = 429;
    error.rateLimitRemaining = 0;
    error.rateLimitReset = new Date(Date.now() + 300000);
    getFileTree.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/scan')
      .send({ url: 'https://github.com/owner/repo' });

    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('rateLimitRemaining', 0);
  });

  it('should return zero score for empty repo', async () => {
    getRepoInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/empty-repo',
    });
    getFileTree.mockResolvedValue({
      tree: [],
      truncated: false,
    });

    const res = await request(app)
      .post('/api/scan')
      .send({ url: 'https://github.com/owner/empty-repo' });

    expect(res.status).toBe(200);
    expect(res.body.overallScore).toBe(0);
    expect(res.body.primitives.every((p) => p.detected === false)).toBe(true);
  });

  it('should accept optional branch parameter', async () => {
    getRepoInfo.mockResolvedValue({
      defaultBranch: 'main',
      fullName: 'owner/repo',
    });
    getFileTree.mockResolvedValue({
      tree: [],
      truncated: false,
    });

    const res = await request(app)
      .post('/api/scan')
      .send({ url: 'https://github.com/owner/repo', branch: 'develop' });

    expect(res.status).toBe(200);
    expect(getFileTree).toHaveBeenCalledWith('owner', 'repo', 'develop');
  });
});
