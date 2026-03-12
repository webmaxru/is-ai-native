#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { formatResult, scanGitHubTarget, scanLocalTarget } from '../src/index.js';

const HELP_TEXT = `is-ai-native CLI

Usage:
  is-ai-native scan <target> [--output json|human|csv|summary] [--branch <branch>] [--token <token>] [--fail-below <score>]
  is-ai-native --help
  is-ai-native --version

Examples:
  is-ai-native scan microsoft/vscode
  is-ai-native scan https://github.com/microsoft/vscode --output human
  is-ai-native scan . --output csv
  is-ai-native scan . --output summary --fail-below 60
`;

function isLikelyPath(target) {
  return target.startsWith('.') || target.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(target);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
      output: { type: 'string', short: 'o', default: 'json' },
      branch: { type: 'string', short: 'b' },
      token: { type: 'string', short: 't' },
      'fail-below': { type: 'string' },
    },
  });

  if (values.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (values.version) {
    process.stdout.write('@is-ai-native/cli 0.1.0\n');
    return;
  }

  const [command, target] = positionals;
  if (command !== 'scan' || !target) {
    process.stderr.write(HELP_TEXT);
    process.exitCode = 1;
    return;
  }

  if (!['json', 'human', 'csv', 'summary'].includes(values.output)) {
    process.stderr.write('Invalid output format. Expected one of: json, human, csv, summary\n');
    process.exitCode = 1;
    return;
  }

  const failBelow = values['fail-below'] == null ? null : Number(values['fail-below']);
  if (values['fail-below'] != null && (!Number.isFinite(failBelow) || failBelow < 0 || failBelow > 100)) {
    process.stderr.write('Invalid --fail-below value. Expected a number between 0 and 100\n');
    process.exitCode = 1;
    return;
  }

  const useLocal = isLikelyPath(target) || (await exists(target));
  const result = useLocal
    ? await scanLocalTarget(target)
    : await scanGitHubTarget(target, {
        branch: values.branch,
        token: values.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN_FOR_SCAN,
      });

  process.stdout.write(`${formatResult(result, values.output)}\n`);

  if (failBelow != null && result.score < failBelow) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
