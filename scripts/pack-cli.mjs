import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const packOutputDir = resolve(workspaceRoot, 'artifacts', 'cli', 'pack');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function removeExistingTarballs() {
  await mkdir(packOutputDir, { recursive: true });

  const entries = await readdir(packOutputDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^is-ai-native-.*\.tgz$/i.test(entry.name))
      .map((entry) => rm(resolve(packOutputDir, entry.name), { force: true, maxRetries: 5, retryDelay: 200 }))
  );
}

function packCli() {
  const result = spawnSync(
    npmCommand,
    ['pack', './packages/cli', '--pack-destination', packOutputDir],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm pack failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function main() {
  await removeExistingTarballs();
  packCli();
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});