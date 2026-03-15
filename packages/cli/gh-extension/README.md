# gh-is-ai-native

GitHub CLI extension for scanning local repositories and GitHub repositories for AI-native development primitives.

## Install

```bash
gh extension install webmaxru/gh-is-ai-native
```

On Windows, GitHub CLI runs script-based extensions through `sh.exe`. Install Git for Windows if `gh` reports that `sh.exe` is missing.

This extension requires Node.js 22 or newer because the generated launcher executes a bundled Node runtime entrypoint.

## Usage

```bash
gh is-ai-native scan <target> [--output json|human|csv|summary] [--branch <branch>] [--token <token>] [--fail-below <score>]
```

Examples:

```bash
gh is-ai-native scan . --output human
gh is-ai-native scan microsoft/vscode --output summary
gh is-ai-native scan https://github.com/microsoft/vscode --branch main --output json
gh is-ai-native scan . --output summary --fail-below 60
```

## Output Modes

- `json`: full structured scan result
- `human`: readable console report with a preferred-agent headline plus full per-assistant detail
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

## Source of Truth

This repository is generated from the `packages/cli` and `packages/core` sources in the main `is-ai-native` workspace. Do not edit generated files here manually unless you also update the source workspace.