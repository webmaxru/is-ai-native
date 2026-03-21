# Is AI-Native VS Code Extension

Scans the current workspace or a GitHub repository using the shared `@is-ai-native/core` package, renders a readiness report in a VS Code webview, and lets you open matched local workspace files directly from the results.

The hosted web application can now be deployed with either the default scale-to-zero Container Apps strategy or a keep-warm mode that pins one replica for faster startup. That deployment option is documented in the repository root README.

## Status

- Extension id: `adbfaa08-0a72-47e0-93d8-d5ec8ddaff6b.is-ai-native`
- Marketplace publisher: `adbfaa08-0a72-47e0-93d8-d5ec8ddaff6b`
- Marketplace URL: `https://marketplace.visualstudio.com/items?itemName=salnikov.is-ai-native`
- Entry point: `dist/extension.js`
- Engine target: VS Code `^1.99.0`

The extension manifest is configured for VS Code Marketplace packaging and publishing.

## Install

Install from the Visual Studio Code Marketplace:

`https://marketplace.visualstudio.com/items?itemName=salnikov.is-ai-native`

## Build And Test

From the repository root:

```powershell
npm install
npm run build:vscode-extension
npm run test:vscode-extension
```

## Package And Publish

From the repository root:

```powershell
npm run package:vscode-extension
npm run publish:vscode-extension
```

For the normal coordinated release path, run this from the repository root instead:

```powershell
npm run release:all -- 0.1.4 --publish --push
```

That root command updates the VS Code extension version together with the standalone CLI and GitHub CLI extension, runs the release validation build and test steps, and then publishes the extension.

If you prefer running `vsce` directly, run it from `packages/vscode-extension`. Running `vsce` from the repository root targets the workspace `package.json`, which does not contain the extension manifest fields required by the Marketplace.

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
- Highlights the preferred agent in the summary while still showing every assistant score and every per-assistant primitive section.
- Allows direct opening of matched files for local workspace scans.

## Settings

- `isAiNative.githubToken`: optional GitHub token for remote scans

## Notes

- The extension bundle must remain ESM. The shared core uses `import.meta.url` to load bundled configuration.
- The build copies `packages/core/config/*.json` into `packages/vscode-extension/config` so Marketplace installs include the scanner definitions required at runtime.
- File-opening actions only apply to local workspace results, not remote GitHub scans.
- The current UX is command-driven with a results webview. Sidebar views are still future work.
