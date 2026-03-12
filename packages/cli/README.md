# Is AI-Native CLI

The CLI package provides a source-based terminal interface for the shared `@is-ai-native/core` scan engine.

For Azure-hosted web deployments, the shared backend now reports the active Container Apps startup mode via `/api/config` and `/health`. Use the root deployment docs when you need to keep one replica warm instead of scaling to zero.

## Status

- Package name: `@is-ai-native/cli`
- Executable: `is-ai-native`
- Distribution: private workspace package
- Scope: local filesystem scans and GitHub repository scans

This package is not currently published to npm and is not yet wrapped as a native `gh` extension. Use it from the workspace source.

## Run From Source

From the repository root:

```powershell
npm install
node packages/cli/bin/cli.js --help
```

To expose the `is-ai-native` command in your shell during local development:

```powershell
npm install
npm link --workspace packages/cli
is-ai-native --help
```

## Usage

```powershell
is-ai-native scan <target> [--output json|human|csv|summary] [--branch <branch>] [--token <token>] [--fail-below <score>]
```

Targets can be:

- a local path such as `.` or `C:\repo`
- a GitHub short reference such as `microsoft/vscode`
- a GitHub URL such as `https://github.com/microsoft/vscode`

Examples:

```powershell
is-ai-native scan . --output human
is-ai-native scan microsoft/vscode --output summary
is-ai-native scan https://github.com/microsoft/vscode --branch main --output json
is-ai-native scan . --output summary --fail-below 60
```

## Output Modes

- `json`: full structured scan result
- `human`: readable console report
- `csv`: one row per primitive
- `summary`: one-line CI-friendly output

## Exit Codes

- `0`: success
- `1`: usage or runtime error
- `2`: scan completed, but score was below `--fail-below`

## Authentication

For remote GitHub scans, token resolution order is:

1. `--token`
2. `GITHUB_TOKEN`
3. `GH_TOKEN_FOR_SCAN`

Using a token is recommended for repeated scans because unauthenticated GitHub API usage is rate-limited.