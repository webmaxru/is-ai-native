# gh-is-ai-native

![Is AI-Native GitHub CLI extension social card](./assets/brand/social-card.png)

Use the GitHub CLI extension to scan the current workspace or a GitHub repository through `gh is-ai-native`.

The extension bundles the same shared scan engine used by the web app, VS Code extension, and standalone CLI.

## Overview

- **Command**: `gh is-ai-native scan`
- **Scope**: local filesystem scans and GitHub repository scans
- **Runtime**: GitHub CLI plus Node.js 22 or newer
- **Distribution**: generated repository export built from this workspace

## What You Get

- **Shared scoring model** with the rest of the project surfaces
- **Per-assistant results** for GitHub Copilot, Claude Code, and OpenAI Codex
- **Primitive-level detection** for instructions, prompts, agents, skills, MCP config, and agent hooks
- **Native GitHub CLI workflow** for terminal users already working in `gh`

## Install

```bash
gh extension install webmaxru/gh-is-ai-native
```

On Windows, GitHub CLI runs script-based extensions through `sh.exe`. Install Git for Windows if `gh` reports that `sh.exe` is missing.

## Usage

```bash
gh is-ai-native scan [target] [--output human|json|csv|summary] [--branch <branch>] [--token <token>] [--fail-below <score>]
```

If `target` is omitted, the extension scans the current workspace.

Examples:

```bash
gh is-ai-native scan
gh is-ai-native scan .
gh is-ai-native scan microsoft/vscode --output summary
gh is-ai-native scan https://github.com/microsoft/vscode --branch main
gh is-ai-native scan . --output summary --fail-below 60
```

## Output Modes

- `human`: readable console report with a preferred-agent headline plus full per-assistant detail
- `json`: full structured scan result
- `csv`: one row per primitive
- `summary`: one-line CI-friendly output based on the preferred agent

## Exit Codes

- `0`: success
- `1`: usage or runtime error
- `2`: scan completed, but the score was below `--fail-below`

## Authentication

For remote GitHub scans, token resolution order is:

1. `--token`
2. `GITHUB_TOKEN`
3. `GH_TOKEN_FOR_SCAN`

## Related Components

- [../../README.md](../../README.md) for the project overview and web app
- [../cli/README.md](../cli/README.md) for the standalone CLI
- [../vscode-extension/README.md](../vscode-extension/README.md) for the VS Code extension

## Development And Release

Build the generated GitHub CLI extension export from the repository root:

```powershell
npm install
npm run build:gh-extension
npm run test:gh-extension
```

This writes a standalone extension layout to `artifacts/gh-extension/repo` with the launcher, bundled entrypoint, copied scanner config, brand assets, README, and license.

For the coordinated release flow, run:

```powershell
npm run release:all -- 0.1.4 --publish --push
```

To sync the generated extension repository directly, set `GH_EXTENSION_REPOSITORY` and `GH_EXTENSION_SYNC_TOKEN`, then run:

```powershell
npm run publish:gh-extension
```

This repository export is generated from `packages/cli`, `packages/gh-extension`, and `packages/core` in the main workspace. Do not edit generated files without updating the source workspace as well.
