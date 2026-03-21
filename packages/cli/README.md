# Is AI-Native Standalone CLI

The standalone CLI provides a terminal interface for the shared scan engine used across the project.

For the GitHub CLI extension export surface, see `../gh-extension/README.md`.

## Status

- Package name: `is-ai-native`
- Executable: `is-ai-native`
- Scope: local filesystem scans and GitHub repository scans
- Distribution: publishable npm package backed by a bundled runtime artifact

## Install From npm

After the first npm publish, these commands will work:

```powershell
npm install is-ai-native
is-ai-native --help
```

This package requires Node.js 22 or newer.

If you want an ephemeral npm run without a prior install, `npx is-ai-native` will still prompt before downloading the package because that behavior comes from npm itself, not from this CLI.

## Standalone Download

Tagged releases also publish portable standalone bundles that do not require npm installation. Download the bundle for your platform from the GitHub release assets, extract it, and run the executable directly.

On Windows, run:

```powershell
.\is-ai-native.exe --help
```

On Linux, run:

```bash
./is-ai-native --help
```

Each standalone bundle includes the executable, the bundled CLI module, and the `config/` directory required by the scanner, so keep the extracted files together.

## Release Checklist

For a coordinated release from the repository root:

```powershell
npm run release:all -- 0.1.4 --publish --push
```

That command updates the CLI version together with the VS Code extension and GitHub CLI extension versions, runs validation, publishes the VS Code extension, syncs the GitHub CLI extension repository, and pushes the `cli-v<version>` tag that triggers `.github/workflows/publish-cli.yml`.

If you need a CLI-focused validation pass before the full release flow, run:

```powershell
npm install
npm run build:cli
npm run build:cli:standalone
npm run test:cli
npm run pack:cli
npx .\artifacts\cli\pack\is-ai-native-<version>.tgz --help
```

On npmjs.com, open the `is-ai-native` package settings and add a Trusted Publisher for GitHub Actions with:

```text
Organization or user: webmaxru
Repository: is-ai-native
Workflow filename: publish-cli.yml
```

Trusted publishing uses GitHub Actions OIDC to exchange the workflow identity for a short-lived npm publish credential. That removes the need for a long-lived `NPM_TOKEN` secret and gives you automatic npm provenance for public packages published from this public repository.

## Run From Source

From the repository root:

```powershell
npm install
node packages/cli/bin/cli.js --help
```

To expose the `is-ai-native` command in your shell during local development:

```powershell
npm install
npm link .\packages\cli
is-ai-native --help
```

To verify the packaged artifact locally before publishing:

```powershell
npm run pack:cli
npx .\artifacts\cli\pack\is-ai-native-0.1.2.tgz --help
```

To build the no-install standalone bundle locally:

```powershell
npm run build:cli:standalone
```

That command writes a portable bundle to `artifacts/cli/standalone/<platform>-<arch>`.

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