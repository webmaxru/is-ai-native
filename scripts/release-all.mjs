import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const packageFiles = [
  resolve(workspaceRoot, 'packages', 'cli', 'package.json'),
  resolve(workspaceRoot, 'packages', 'vscode-extension', 'package.json'),
  resolve(workspaceRoot, 'packages', 'gh-extension', 'package.json'),
];
const packageLockPath = resolve(workspaceRoot, 'package-lock.json');
const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

function loadWorkspaceEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  try {
    process.loadEnvFile(resolve(workspaceRoot, '.env'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function usage() {
  return [
    'Usage:',
    '  npm run release:all -- [<version>] [--dry-run] [--commit] [--push] [--publish]',
    '  npm run release:all:dry-run -- [<version>]',
    '',
    'If <version> is omitted, the script bumps the next unified patch version across the CLI, VS Code extension, and GH extension manifests. When versions differ, it starts from the highest current version and increments once.',
    '',
    'Examples:',
    '  npm run release:all -- --dry-run',
    '  npm run release:all -- 0.1.4 --dry-run',
    '  npm run release:all:dry-run',
    '  npm run release:all -- 0.1.4 --commit',
    '  npm run release:all -- --publish --push',
    '  npm run release:all -- 0.1.4 --publish --push',
  ].join('\n');
}

function readBooleanFlag(name) {
  const value = process.env[name];
  return value === 'true' || value === '1';
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((value) => value.startsWith('--')));
  const version = argv.find((value) => !value.startsWith('--')) ?? process.env.npm_config_version;

  if (version && !versionPattern.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  return {
    version,
    dryRun: flags.has('--dry-run') || readBooleanFlag('npm_config_dry_run'),
    publish: flags.has('--publish') || readBooleanFlag('npm_config_publish'),
    push: flags.has('--push') || readBooleanFlag('npm_config_push'),
    commit: flags.has('--commit') || readBooleanFlag('npm_config_commit') || flags.has('--publish') || readBooleanFlag('npm_config_publish'),
  };
}

function parseVersion(version) {
  const match = versionPattern.exec(version);

  if (!match) {
    throw new Error(`Invalid version: ${version}`);
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);

  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major;
  }

  if (leftVersion.minor !== rightVersion.minor) {
    return leftVersion.minor - rightVersion.minor;
  }

  return leftVersion.patch - rightVersion.patch;
}

function incrementPatch(version) {
  const parsed = parseVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

async function readCurrentPackageVersions() {
  const versions = [];

  for (const filePath of packageFiles) {
    const manifest = JSON.parse(await readFile(filePath, 'utf8'));
    versions.push(manifest.version);
  }

  return versions;
}

function determineReleaseVersion(explicitVersion, currentVersions) {
  if (explicitVersion) {
    return {
      version: explicitVersion,
      inferred: false,
    };
  }

  if (currentVersions.length === 0) {
    throw new Error(usage());
  }

  const highestVersion = [...currentVersions].sort(compareVersions).at(-1);

  return {
    version: incrementPatch(highestVersion),
    inferred: true,
    highestVersion,
  };
}

function resolveExecutable(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (command === 'npm') {
    return 'npm.cmd';
  }

  if (command === 'npx') {
    return 'npx.cmd';
  }

  return command;
}

function run(command, args, { cwd = workspaceRoot, dryRun = false, env = process.env, allowNonZero = false } = {}) {
  const rendered = `${command} ${args.join(' ')}`.trim();
  const executable = resolveExecutable(command);
  process.stdout.write(`${dryRun ? '[dry-run] ' : ''}${rendered}\n`);

  if (dryRun) {
    return { stdout: '', stderr: '', status: 0 };
  }

  const result = spawnSync(executable, args, {
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

function ensureCleanWorktree(dryRun) {
  if (dryRun) {
    process.stdout.write('[dry-run] git status --porcelain\n');
    return;
  }

  const status = run('git', ['status', '--porcelain']);
  if (status.stdout.trim()) {
    throw new Error('Release automation requires a clean git worktree. Commit or stash existing changes first.');
  }
}

function getCurrentBranch(dryRun) {
  if (dryRun) {
    return 'current-branch';
  }

  return run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
}

async function updateVersions(version, dryRun) {
  const changed = [];

  for (const filePath of packageFiles) {
    const manifest = JSON.parse(await readFile(filePath, 'utf8'));

    if (manifest.version === version) {
      continue;
    }

    manifest.version = version;
    changed.push(filePath);

    if (!dryRun) {
      await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    }
  }

  return changed;
}

async function main() {
  loadWorkspaceEnv();

  const { version: requestedVersion, dryRun, publish, push, commit } = parseArgs(process.argv.slice(2));
  const currentVersions = await readCurrentPackageVersions();
  const { version, inferred, highestVersion } = determineReleaseVersion(requestedVersion, currentVersions);
  const tagName = `cli-v${version}`;

  if (inferred) {
    process.stdout.write(`No version provided. Using next unified version ${version} from highest current version ${highestVersion}.\n`);
  }

  if (publish && !push) {
    throw new Error('--publish requires --push so the CLI tag can trigger trusted publishing.');
  }

  if (push && !commit) {
    throw new Error('--push requires --commit or --publish.');
  }

  if (commit) {
    ensureCleanWorktree(dryRun);
  }

  const changedFiles = await updateVersions(version, dryRun);

  if (changedFiles.length > 0) {
    process.stdout.write(`Updated ${changedFiles.length} package manifest(s) to version ${version}.\n`);
  } else {
    process.stdout.write(`All release package manifests already use version ${version}.\n`);
  }

  run('npm', ['install', '--package-lock-only'], { dryRun });

  const validationSteps = [
    ['npm', ['run', 'build:cli']],
    ['npm', ['run', 'build:cli:standalone']],
    ['npm', ['run', 'test:cli']],
    ['npm', ['run', 'build:vscode-extension']],
    ['npm', ['run', 'test:vscode-extension']],
    ['npm', ['run', 'build:gh-extension']],
    ['npm', ['run', 'test:gh-extension']],
  ];

  for (const [command, args] of validationSteps) {
    run(command, args, { dryRun });
  }

  if (!commit) {
    process.stdout.write('Release preparation completed without commit or publish actions.\n');
    return;
  }

  const stagedFiles = [...packageFiles, packageLockPath].map((filePath) => relative(workspaceRoot, filePath).replaceAll('\\', '/'));
  run('git', ['add', ...stagedFiles], { dryRun });

  if (changedFiles.length > 0) {
    run('git', ['commit', '-m', `Release ${version}`], { dryRun });
  } else {
    process.stdout.write('No version file changes to commit; reusing the current HEAD commit.\n');
  }

  const branchName = getCurrentBranch(dryRun);

  if (push) {
    run('git', ['push', 'origin', branchName], { dryRun });
  }

  if (!publish) {
    process.stdout.write('Release commit created without publish actions.\n');
    return;
  }

  run('npm', ['run', 'publish:vscode-extension'], { dryRun });
  run('npm', ['run', 'publish:gh-extension'], { dryRun });
  run('git', ['tag', '-a', tagName, '-m', `CLI release ${version}`], { dryRun });
  run('git', ['push', 'origin', tagName], { dryRun });

  process.stdout.write(`Release ${version} has been published or queued for all three deliverables.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});