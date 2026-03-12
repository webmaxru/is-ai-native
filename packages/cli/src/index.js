import { resolve } from 'node:path';
import { Profiles, parseRepoUrl, scanRepository } from '@is-ai-native/core';
import { formatResult } from './formatters.js';

export async function scanGitHubTarget(repoInput, { token, branch, configSource } = {}) {
  const parsed = parseRepoUrl(repoInput);
  return scanRepository(
    Profiles.github({
      owner: parsed.owner,
      repo: parsed.repo,
      token,
      branch,
      configSource,
    })
  );
}

export async function scanLocalTarget(rootPath = '.', { configSource, ignoreDirectories, ignoreNames } = {}) {
  return scanRepository(
    Profiles.localFilesystem({
      rootPath: resolve(rootPath),
      configSource,
      ignoreDirectories,
      ignoreNames,
    })
  );
}

export { formatResult };
