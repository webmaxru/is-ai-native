import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitHubFileTreeSource, InMemoryFileTreeSource, LocalFileTreeSource } from '../src/index.js';

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

test('in-memory file tree source returns a stable copy of paths', async () => {
  const source = new InMemoryFileTreeSource(['README.md'], { kind: 'memory', label: 'fixture' });
  const result = await source.getFileTree();

  assert.deepEqual(result.paths, ['README.md']);
  assert.equal(result.metadata.label, 'fixture');
});

test('local file tree source ignores node_modules and .git', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-local-'));

  try {
    mkdirSync(join(tempDir, 'src'));
    mkdirSync(join(tempDir, 'node_modules'));
    mkdirSync(join(tempDir, '.git'));
    writeFileSync(join(tempDir, 'src', 'app.js'), 'console.log("ok");');
    writeFileSync(join(tempDir, 'node_modules', 'ignored.js'), 'ignored');
    writeFileSync(join(tempDir, '.git', 'config'), '[core]');

    const result = await new LocalFileTreeSource({ rootPath: tempDir }).getFileTree();
    assert.deepEqual(result.paths, ['src/app.js']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('github file tree source maps repo metadata for orchestrators', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    const callIndex = global.fetch.calls.push(args) - 1;
    const responses = [
      jsonResponse({ default_branch: 'main', description: 'Repo', stargazers_count: 7 }, 200),
      jsonResponse({ tree: [{ path: 'README.md' }] }, 200),
    ];
    return responses[callIndex];
  };
  global.fetch.calls = [];

  try {
    const result = await new GitHubFileTreeSource({ owner: 'microsoft', repo: 'vscode' }).getFileTree();
    assert.equal(result.metadata.url, 'https://github.com/microsoft/vscode');
    assert.deepEqual(result.paths, ['README.md']);
  } finally {
    global.fetch = originalFetch;
  }
});
