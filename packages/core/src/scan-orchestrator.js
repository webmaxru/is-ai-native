import { basename } from 'node:path';
import { BundledConfigSource } from './config-source.js';
import { GitHubFileTreeSource, InMemoryFileTreeSource, LocalFileTreeSource } from './file-tree-source.js';
import { scanPrimitives } from './scanner.js';
import { calculateOverallScore, calculatePerAssistantScores, getVerdict } from './scorer.js';

function buildRepositoryMetadata(metadata) {
  if (metadata.kind === 'github') {
    return {
      repo_url: metadata.url,
      repo_name: `${metadata.owner}/${metadata.repo}`,
      description: metadata.description ?? null,
      stars: metadata.stars ?? null,
      branch: metadata.branch ?? metadata.default_branch ?? null,
      repo_path: null,
    };
  }

  if (metadata.kind === 'local') {
    return {
      repo_url: null,
      repo_name: basename(metadata.rootPath),
      description: null,
      stars: null,
      branch: null,
      repo_path: metadata.rootPath,
    };
  }

  return {
    repo_url: null,
    repo_name: null,
    description: null,
    stars: null,
    branch: null,
    repo_path: null,
  };
}

/**
 * Runs a repository scan using pluggable config and file tree sources.
 * @param {{ fileTreeSource: import('./file-tree-source.js').FileTreeSource, configSource?: import('./config-source.js').ConfigSource }} options
 * @returns {Promise<object>}
 */
export async function scanRepository({ fileTreeSource, configSource = new BundledConfigSource() }) {
  if (!fileTreeSource) {
    throw new Error('fileTreeSource is required');
  }

  const { primitives, assistants } = configSource.loadConfig();
  const { paths, metadata = {} } = await fileTreeSource.getFileTree();
  const primitiveResults = scanPrimitives(paths, primitives);
  const score = calculateOverallScore(primitiveResults);
  const perAssistant = calculatePerAssistantScores(primitiveResults, assistants);

  return {
    source: metadata.kind || 'unknown',
    ...buildRepositoryMetadata(metadata),
    score,
    verdict: getVerdict(score),
    scanned_at: new Date().toISOString(),
    primitives: primitiveResults,
    per_assistant: perAssistant,
    paths_scanned: paths.length,
  };
}

export const Profiles = {
  github({ owner, repo, token, branch, configSource } = {}) {
    return {
      configSource,
      fileTreeSource: new GitHubFileTreeSource({ owner, repo, token, branch }),
    };
  },
  localFilesystem({ rootPath, ignoreDirectories, ignoreNames, configSource } = {}) {
    return {
      configSource,
      fileTreeSource: new LocalFileTreeSource({ rootPath, ignoreDirectories, ignoreNames }),
    };
  },
  inMemory({ paths, metadata, configSource } = {}) {
    return {
      configSource,
      fileTreeSource: new InMemoryFileTreeSource(paths, metadata),
    };
  },
};
