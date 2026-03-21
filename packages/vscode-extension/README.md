# Is AI-Native VS Code Extension

Use the VS Code extension to scan the current workspace or a GitHub repository without leaving the editor.

The extension uses the shared `@is-ai-native/core` package and renders results in a VS Code webview with direct file-opening support for local workspace matches.

## Overview

- **Marketplace id**: `salnikov.is-ai-native`
- **Entry point**: `dist/extension.js`
- **Engine target**: VS Code `^1.99.0`
- **Primary use**: workspace scans and GitHub repository scans inside VS Code

## What You Get

- **Shared scoring model** with the rest of the project surfaces
- **Per-assistant results** for GitHub Copilot, Claude Code, and OpenAI Codex
- **Primitive-level detection** for instructions, prompts, agents, skills, MCP config, and agent hooks
- **Editor-native results** with direct file opening for local matches

## Install

Install from the Visual Studio Code Marketplace:

<https://marketplace.visualstudio.com/items?itemName=salnikov.is-ai-native>

## Commands

- `Is AI-Native: Scan Workspace`
- `Is AI-Native: Scan GitHub Repository`
- `Is AI-Native: Open Last Results`

## Usage In VS Code

- Run **Scan Workspace** to inspect the currently opened folder without sending local source files through the web app.
- Run **Scan GitHub Repository** to inspect a remote repository through the shared GitHub scan flow.
- Open **Last Results** to revisit the latest report in the extension webview.

## Settings

- `isAiNative.githubToken`: optional GitHub token for remote scans from inside the extension

## Notes

- The bundle must remain ESM because the shared core uses `import.meta.url` to load bundled configuration.
- The build copies `packages/core/config/*.json` into `packages/vscode-extension/config` so Marketplace installs include the required scanner definitions.
- File-opening actions apply to local workspace results only, not remote GitHub scans.
- The current UX is command-driven with a results webview. A dedicated sidebar view is still future work.

## Related Components

- [../../README.md](../../README.md) for the project overview and web app
- [../cli/README.md](../cli/README.md) for the standalone CLI
- [../gh-extension/README.md](../gh-extension/README.md) for the GitHub CLI extension

## Development And Release

Build and test from the repository root:

```powershell
npm install
npm run build:vscode-extension
npm run test:vscode-extension
```

Package and publish from the repository root:

```powershell
npm run package:vscode-extension
npm run publish:vscode-extension
```

For the coordinated release flow, run:

```powershell
npm run release:all -- --publish --push
```

If you omit the version, the release script reads the CLI, VS Code extension, and GitHub CLI extension manifests, takes the highest current version, and bumps the patch once to create the next unified release version.

Run the extension from source:

1. Open the repository in VS Code.
2. Run `npm install` from the repository root.
3. Run `npm run build:vscode-extension`.
4. Launch an Extension Development Host from Run and Debug.

If you prefer running `vsce` directly, run it from `packages/vscode-extension`. Running `vsce` from the repository root targets the workspace `package.json`, not the extension manifest.
