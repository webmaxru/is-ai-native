# Is AI-Native CLI

The CLI package provides a source-based terminal interface for the shared `@is-ai-native/core` scan engine.

For Azure-hosted web deployments, the shared backend now reports the active Container Apps startup mode via `/api/config` and `/health`. Use the root deployment docs when you need to keep one replica warm instead of scaling to zero.

## Status

- Package name: `@is-ai-native/cli`
- Executable: `is-ai-native`
- Distribution: private workspace package plus generated `gh-is-ai-native` export artifacts
- Scope: local filesystem scans and GitHub repository scans

This package is not currently published to npm. It can generate the contents for a dedicated `gh-is-ai-native` repository, which is the supported way to publish it as a native GitHub CLI extension from this monorepo.

## GitHub CLI Extension Export

Build the dedicated `gh-is-ai-native` repository contents from the workspace root:

```powershell
npm install
npm run build:gh-extension
```

This writes a standalone script-based GitHub CLI extension layout to `artifacts/gh-extension/repo` with:

- a root launcher named `gh-is-ai-native`
- a bundled Node entrypoint named `gh-is-ai-native.mjs`
- a bundled `config/` directory copied from `packages/core/config`
- a dedicated extension README and the project license

The repository includes a sync workflow at `.github/workflows/gh-extension-sync.yml` that can push those generated contents into a separate `owner/gh-is-ai-native` repository.

Required GitHub Actions configuration in the source repository:

- repository variable `GH_EXTENSION_REPOSITORY`: the target repository in `owner/gh-is-ai-native` format
- secret `GH_EXTENSION_SYNC_TOKEN`: a token with `contents:write` access to that target repository

Because GitHub CLI installs script extensions from the repository root, publishing through a separate generated repository is the supported path when the CLI source lives under `packages/cli` in this monorepo.

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
- `human`: readable console report with a preferred-agent headline plus full per-assistant detail
- `csv`: one row per primitive
- `summary`: one-line CI-friendly output based on the preferred agent

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