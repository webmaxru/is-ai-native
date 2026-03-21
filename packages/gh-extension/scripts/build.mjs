import { build } from 'esbuild';
import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..', '..', '..');
const extensionPackageRoot = resolve(workspaceRoot, 'packages', 'gh-extension');
const cliPackageRoot = resolve(workspaceRoot, 'packages', 'cli');
const extensionName = 'gh-is-ai-native';
const minimumSupportedNodeMajor = 22;
const outputDir = process.env.GH_EXTENSION_OUTPUT_DIR
  ? resolve(process.env.GH_EXTENSION_OUTPUT_DIR)
  : resolve(workspaceRoot, 'artifacts', 'gh-extension', 'repo');

const bundlePath = resolve(outputDir, `${extensionName}.mjs`);
const launcherPath = resolve(outputDir, extensionName);

const launcher = `#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to run ${extensionName}. Install Node.js ${minimumSupportedNodeMajor} or newer and try again." >&2
  exit 1
fi

exec node "$SCRIPT_DIR/${extensionName}.mjs" "$@"
`;

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await build({
    entryPoints: [resolve(cliPackageRoot, 'bin', 'cli.js')],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: `node${minimumSupportedNodeMajor}`,
    legalComments: 'none',
  });

  await writeFile(launcherPath, launcher, 'utf8');
  await chmod(launcherPath, 0o755);
  await chmod(bundlePath, 0o755);

  await cp(resolve(workspaceRoot, 'packages', 'core', 'config'), resolve(outputDir, 'config'), {
    recursive: true,
  });
  await cp(resolve(workspaceRoot, 'LICENSE'), resolve(outputDir, 'LICENSE'));
  await cp(resolve(extensionPackageRoot, 'README.md'), resolve(outputDir, 'README.md'));
  await cp(resolve(extensionPackageRoot, 'assets'), resolve(outputDir, 'assets'), {
    recursive: true,
  });

  process.stdout.write(`Generated ${extensionName} repo contents in ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});