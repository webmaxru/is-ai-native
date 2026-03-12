import * as vscode from 'vscode';
import { Profiles, parseRepoUrl, scanRepository } from '@is-ai-native/core';
import { ResultsPanel } from './results-panel.js';
import { resolveWorkspaceFileUri } from './workspace-file-actions.js';
import { WorkspaceFileTreeSource } from './workspace-file-tree-source.js';

async function pickWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    throw new Error('Open a workspace folder before running a local scan.');
  }

  if (folders.length === 1) {
    return folders[0];
  }

  return vscode.window.showWorkspaceFolderPick({
    placeHolder: 'Select a workspace folder to scan',
  });
}

export function activate(context) {
  const panel = new ResultsPanel(vscode, context.extensionUri, {
    async openFile(panelContext, relativePath) {
      const uri = resolveWorkspaceFileUri(vscode, panelContext?.workspaceFolder, relativePath);
      if (!uri) {
        void vscode.window.showWarningMessage('Unable to open the selected file from the scan results.');
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, { preview: false });
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('is-ai-native.scanWorkspace', async () => {
      try {
        const workspaceFolder = await pickWorkspaceFolder();
        if (!workspaceFolder) {
          return;
        }

        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning workspace for AI-native primitives',
          },
          async () =>
            scanRepository({
              fileTreeSource: new WorkspaceFileTreeSource({
                vscodeApi: vscode,
                workspaceFolder,
              }),
            })
        );

        panel.show(result, { workspaceFolder });
      } catch (error) {
        void vscode.window.showErrorMessage(error.message);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('is-ai-native.scanGitHub', async () => {
      try {
        const repoInput = await vscode.window.showInputBox({
          prompt: 'GitHub repository URL or owner/repo',
          placeHolder: 'https://github.com/owner/repo',
        });

        if (!repoInput) {
          return;
        }

        const parsed = parseRepoUrl(repoInput);
        const token = vscode.workspace.getConfiguration('isAiNative').get('githubToken');
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning GitHub repository for AI-native primitives',
          },
          async () =>
            scanRepository(
              Profiles.github({
                owner: parsed.owner,
                repo: parsed.repo,
                token: token || undefined,
              })
            )
        );

        panel.show(result);
      } catch (error) {
        void vscode.window.showErrorMessage(error.message);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('is-ai-native.openResults', async () => {
      panel.reveal();
    })
  );
}

export function deactivate() {}
