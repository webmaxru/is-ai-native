import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoUrl } from '../src/index.js';

test('core url parser handles short form owner/repo', () => {
  const result = parseRepoUrl('microsoft/vscode');
  assert.equal(result.owner, 'microsoft');
  assert.equal(result.repo, 'vscode');
  assert.equal(result.url, 'https://github.com/microsoft/vscode');
});

test('core url parser rejects URLs with query parameters', () => {
  assert.throws(
    () => parseRepoUrl('https://github.com/owner/repo?tab=readme'),
    /URL query parameters are not allowed/
  );
});