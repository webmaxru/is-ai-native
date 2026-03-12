import { readdir } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { fetchRepoTree } from './github.js';

function normalizePath(path) {
  return path.split(sep).join('/');
}

/**
 * Base class for scanning file trees from different environments.
 */
export class FileTreeSource {
  async getFileTree() {
    throw new Error('FileTreeSource.getFileTree() must be implemented by a subclass');
  }
}

/**
 * Retrieves a repository tree from the GitHub API.
 */
export class GitHubFileTreeSource extends FileTreeSource {
  /**
   * @param {{ owner: string, repo: string, token?: string, branch?: string }} options
   */
  constructor({ owner, repo, token, branch }) {
    super();
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.branch = branch;
  }

  async getFileTree() {
    const { paths, repoData } = await fetchRepoTree(this.owner, this.repo, {
      token: this.token,
      branch: this.branch,
    });

    const resolvedBranch = this.branch || repoData.default_branch || null;

    return {
      paths,
      metadata: {
        kind: 'github',
        owner: this.owner,
        repo: this.repo,
        url: `https://github.com/${this.owner}/${this.repo}`,
        description: repoData.description || null,
        stars: repoData.stargazers_count ?? null,
        branch: resolvedBranch,
        default_branch: repoData.default_branch ?? null,
      },
    };
  }
}

/**
 * Returns a fixed in-memory file tree.
 */
export class InMemoryFileTreeSource extends FileTreeSource {
  /**
   * @param {string[]} paths
   * @param {object} [metadata]
   */
  constructor(paths = [], metadata = {}) {
    super();
    this.paths = [...paths];
    this.metadata = metadata;
  }

  async getFileTree() {
    return {
      paths: [...this.paths],
      metadata: { ...this.metadata },
    };
  }
}

/**
 * Walks a local filesystem tree and returns repo-relative paths.
 */
export class LocalFileTreeSource extends FileTreeSource {
  /**
   * @param {{ rootPath: string, ignoreDirectories?: string[], ignoreNames?: string[] }} options
   */
  constructor({ rootPath, ignoreDirectories = ['.git', 'node_modules'], ignoreNames = [] }) {
    super();
    this.rootPath = rootPath;
    this.ignoreDirectories = new Set(ignoreDirectories);
    this.ignoreNames = new Set(ignoreNames);
  }

  async getFileTree() {
    const paths = [];

    const walk = async (currentPath) => {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.ignoreNames.has(entry.name)) {
          continue;
        }

        const nextPath = `${currentPath}${sep}${entry.name}`;

        if (entry.isSymbolicLink()) {
          continue;
        }

        if (entry.isDirectory()) {
          if (this.ignoreDirectories.has(entry.name)) {
            continue;
          }
          await walk(nextPath);
          continue;
        }

        if (entry.isFile()) {
          paths.push(normalizePath(relative(this.rootPath, nextPath)));
        }
      }
    };

    await walk(this.rootPath);

    return {
      paths,
      metadata: {
        kind: 'local',
        rootPath: this.rootPath,
      },
    };
  }
}
