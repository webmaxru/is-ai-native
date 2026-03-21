import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const outputDir = resolve(workspaceRoot, 'artifacts', 'gh-extension', 'repo');

function run(command, args, { cwd = workspaceRoot, env = process.env, dryRun = false, allowNonZero = false } = {}) {
  const rendered = `${command} ${args.join(' ')}`.trim();
  process.stdout.write(`${dryRun ? '[dry-run] ' : ''}${rendered}\n`);

  if (dryRun) {
    return { stdout: '', stderr: '', status: 0 };
  }

  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.status !== 0 && !allowNonZero) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    throw new Error(`${rendered} failed with exit code ${result.status ?? 'unknown'}`);
  }

  return result;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const targetRepository = process.env.GH_EXTENSION_REPOSITORY;
  const pushToken = process.env.GH_EXTENSION_SYNC_TOKEN;

  if (!targetRepository) {
    throw new Error('Set GH_EXTENSION_REPOSITORY to owner/gh-is-ai-native before syncing the GitHub extension.');
  }

  if (!pushToken) {
    throw new Error('Set GH_EXTENSION_SYNC_TOKEN with contents:write access to the target repository before syncing the GitHub extension.');
  }

  if (!targetRepository.includes('/gh-')) {
    throw new Error(`Target repository must look like owner/gh-is-ai-native. Received: ${targetRepository}`);
  }

  run('npm', ['run', 'build:gh-extension'], { dryRun });

  const tempDir = await mkdtemp(resolve(tmpdir(), 'is-ai-native-gh-extension-'));
  const cloneUrl = `https://x-access-token:${pushToken}@github.com/${targetRepository}.git`;

  try {
    run('git', ['clone', cloneUrl, tempDir], { dryRun });

    if (!dryRun) {
      for (const entry of await readdir(tempDir)) {
        if (entry === '.git') {
          continue;
        }

        await rm(resolve(tempDir, entry), { recursive: true, force: true });
      }

      for (const entry of await readdir(outputDir)) {
        await cp(resolve(outputDir, entry), resolve(tempDir, entry), {
          recursive: true,
          force: true,
        });
      }
    }

    run('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: tempDir, dryRun });
    run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], {
      cwd: tempDir,
      dryRun,
    });
    run('git', ['add', '--all'], { cwd: tempDir, dryRun });

    if (!dryRun) {
      const diffResult = run('git', ['diff', '--cached', '--quiet'], {
        cwd: tempDir,
        allowNonZero: true,
      });

      if (diffResult.status === 0) {
        process.stdout.write('No gh extension changes to publish.\n');
        return;
      }
    }

    run('git', ['commit', '-m', `Sync ${targetRepository} export`], { cwd: tempDir, dryRun });
    run('git', ['push', 'origin', 'HEAD:main'], { cwd: tempDir, dryRun });
  } finally {
    if (!dryRun) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});