import { relative } from 'node:path';
import { FileTreeSource } from '@is-ai-native/core';

function normalizePath(path) {
  return path.replaceAll('\\', '/');
}

export class WorkspaceFileTreeSource extends FileTreeSource {
  constructor({ vscodeApi, workspaceFolder }) {
    super();
    this.vscodeApi = vscodeApi;
    this.workspaceFolder = workspaceFolder;
  }

  async getFileTree() {
    const includePattern = new this.vscodeApi.RelativePattern(this.workspaceFolder, '**/*');
    const excludePattern = new this.vscodeApi.RelativePattern(this.workspaceFolder, '**/{.git,node_modules}/**');
    const entries = await this.vscodeApi.workspace.findFiles(includePattern, excludePattern);
    const paths = entries.map((uri) => normalizePath(relative(this.workspaceFolder.uri.fsPath, uri.fsPath)));

    return {
      paths,
      metadata: {
        kind: 'local',
        rootPath: this.workspaceFolder.uri.fsPath,
      },
    };
  }
}
