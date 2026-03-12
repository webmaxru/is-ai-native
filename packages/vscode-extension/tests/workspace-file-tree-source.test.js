import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceFileTreeSource } from '../src/workspace-file-tree-source.js';

class RelativePattern {
  constructor(base, pattern) {
    this.base = base;
    this.pattern = pattern;
  }
}

test('workspace file tree source maps VS Code URIs to repo-relative paths', async () => {
  const workspaceFolder = {
    uri: { fsPath: 'C:\\repo' },
  };
  const fakeVscode = {
    RelativePattern,
    workspace: {
      async findFiles() {
        return [
          { fsPath: 'C:\\repo\\README.md' },
          { fsPath: 'C:\\repo\\.github\\copilot-instructions.md' },
        ];
      },
    },
  };

  const result = await new WorkspaceFileTreeSource({
    vscodeApi: fakeVscode,
    workspaceFolder,
  }).getFileTree();

  assert.deepEqual(result.paths, ['README.md', '.github/copilot-instructions.md']);
  assert.equal(result.metadata.rootPath, 'C:\\repo');
});
