# Is AI-Native CLI

Use the standalone CLI to scan either the current workspace or a GitHub repository from any terminal.

The standalone CLI uses the same shared scan engine as the web app, VS Code extension, and GitHub CLI extension.

## Overview

- **Package name**: `is-ai-native`
- **Executable**: `is-ai-native`
- **Scope**: local filesystem scans and GitHub repository scans
- **Runtime**: Node.js 22 or newer

## What You Get

- **Shared scoring model** with the rest of the project surfaces
- **Per-assistant results** for GitHub Copilot, Claude Code, and OpenAI Codex
- **Primitive-level detection** for instructions, prompts, agents, skills, MCP config, and agent hooks
- **Multiple output formats** for interactive use, CI, and export workflows

## Install

Install from npm:

```powershell
npm install is-ai-native
is-ai-native --help
```

If you prefer not to install from npm, tagged releases also publish portable standalone bundles. After extracting a release bundle, run:

```powershell
.\is-ai-native.exe --help
```

On Linux:

```bash
./is-ai-native --help
```

Each standalone bundle includes the executable, the bundled CLI module, and the `config/` directory required by the scanner, so keep the extracted files together.

## Usage

```powershell
is-ai-native scan [target] [--output human|json|csv|summary] [--branch <branch>] [--token <token>] [--fail-below <score>]
```

Targets can be:

- a local path such as `.` or `C:\repo`
- a GitHub short reference such as `microsoft/vscode`
- a GitHub URL such as `https://github.com/microsoft/vscode`

If `target` is omitted, the CLI scans the current workspace.

Examples:

```powershell
is-ai-native scan
is-ai-native scan .
is-ai-native scan microsoft/vscode --output summary
is-ai-native scan https://github.com/microsoft/vscode --branch main
is-ai-native scan . --output summary --fail-below 60
```

## Output Modes

- `human`: readable console report with a preferred-agent headline plus full per-assistant detail
- `json`: full structured scan result
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

## Related Components

- [../../README.md](../../README.md) for the project overview and web app
- [../gh-extension/README.md](../gh-extension/README.md) for the GitHub CLI extension
- [../vscode-extension/README.md](../vscode-extension/README.md) for the VS Code extension

## Development And Release

Run from source from the repository root:

```powershell
npm install
node packages/cli/bin/cli.js --help
```

Expose the command in your shell during local development:

```powershell
npm install
npm link .\packages\cli
is-ai-native --help
```

Build and validate the CLI package:

```powershell
npm install
npm run build:cli
npm run build:cli:standalone
npm run test:cli
npm run pack:cli
npx .\artifacts\cli\pack\is-ai-native-<version>.tgz --help
```

Coordinated release from the repository root:

```powershell
npm run release:all -- --publish --push
```

If you omit the version, the release script reads the CLI, VS Code extension, and GitHub CLI extension manifests, takes the highest current version, and bumps the patch once to create the next unified release version.

Trusted publishing on npm should be configured for GitHub Actions OIDC with:

```text
Organization or user: webmaxru
Repository: is-ai-native
Workflow filename: publish-cli.yml
```
