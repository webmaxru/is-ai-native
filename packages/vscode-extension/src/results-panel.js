import { renderResultsHtml } from './results-view.js';

function createNonce() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export class ResultsPanel {
  constructor(vscodeApi, extensionUri, handlers = {}) {
    this.vscodeApi = vscodeApi;
    this.extensionUri = extensionUri;
    this.handlers = handlers;
    this.panel = null;
    this.lastResult = null;
    this.lastContext = null;
  }

  ensurePanel() {
    if (this.panel) {
      return;
    }

    this.panel = this.vscodeApi.window.createWebviewPanel(
      'isAiNativeResults',
      'Is AI-Native Results',
      this.vscodeApi.ViewColumn.Beside,
      { enableScripts: true }
    );
    this.panel.onDidDispose(() => {
      this.panel = null;
    });
    this.panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === 'open-file') {
        await this.handlers.openFile?.(this.lastContext, message.path);
      }
    });
  }

  show(result, context = {}) {
    this.lastResult = result;
    this.lastContext = context;
    this.ensurePanel();

    this.panel.webview.html = renderResultsHtml(result, {
      canOpenFiles: !!context.workspaceFolder,
      nonce: createNonce(),
    });
    this.panel.reveal();
  }

  reveal() {
    if (this.panel) {
      this.panel.reveal();
    }
  }
}
