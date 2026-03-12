import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkspaceFileUri } from '../src/workspace-file-actions.js';

test('resolveWorkspaceFileUri resolves safe repo-relative paths', () => {
  const fakeVscode = {
    Uri: {
      joinPath(base, ...segments) {
        return { fsPath: [base.fsPath, ...segments].join('/') };
      },
    },
  };
  const workspaceFolder = { uri: { fsPath: '/repo' } };

  const uri = resolveWorkspaceFileUri(fakeVscode, workspaceFolder, '.github/copilot-instructions.md');
  assert.equal(uri.fsPath, '/repo/.github/copilot-instructions.md');
});

test('resolveWorkspaceFileUri rejects escaping paths', () => {
  const fakeVscode = { Uri: { joinPath() { throw new Error('should not be called'); } } };
  const workspaceFolder = { uri: { fsPath: '/repo' } };

  assert.equal(resolveWorkspaceFileUri(fakeVscode, workspaceFolder, '../secret.txt'), null);
  assert.equal(resolveWorkspaceFileUri(fakeVscode, workspaceFolder, '/absolute/path.txt'), null);
});