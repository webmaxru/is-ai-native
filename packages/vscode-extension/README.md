# Is AI-Native VS Code Extension

Scans the current workspace or a GitHub repository using the shared `@is-ai-native/core` package, renders a readiness report in a VS Code webview, and lets you open matched local workspace files directly from the results.

## Status

- Package name: `@is-ai-native/vscode-extension`
- Distribution: private workspace package
- Entry point: `dist/extension.js`
- Engine target: VS Code `^1.99.0`

The extension is currently intended for source-based development and internal validation. It is not yet published to the VS Code Marketplace.

## Build And Test

From the repository root:

```powershell
npm install
npm run build:vscode-extension
npm run test:vscode-extension
```

## Run From Source

1. Open the repository in VS Code.
2. Run `npm install` from the repository root.
3. Run `npm run build:vscode-extension`.
4. Launch an Extension Development Host from Run and Debug.

## Commands

- `Is AI-Native: Scan Workspace`
- `Is AI-Native: Scan GitHub Repository`
- `Is AI-Native: Open Last Results`

## Features

- Scans the opened workspace using the shared file-tree abstraction.
- Scans GitHub repositories directly from the extension.
- Shows overall score, verdict, per-assistant breakdown, and primitive matches.
- Allows direct opening of matched files for local workspace scans.

## Settings

- `isAiNative.githubToken`: optional GitHub token for remote scans

## Notes

- The extension bundle must remain ESM. The shared core uses `import.meta.url` to load bundled configuration.
- File-opening actions only apply to local workspace results, not remote GitHub scans.
- The current UX is command-driven with a results webview. Sidebar views and marketplace packaging are still future work.
