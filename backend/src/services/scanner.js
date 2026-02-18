/**
 * Pattern matching scanner service.
 * Loads primitives from configuration and matches against file tree paths.
 * @module scanner
 */

import { minimatch } from 'minimatch';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Default config path relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_CONFIG_PATH = join(__dirname, '..', 'config', 'primitives.json');

/** @type {import('./config-loader.js').PrimitivesConfig | null} */
let cachedConfig = null;

/**
 * Loads the primitives configuration, using a cache for subsequent calls.
 * @returns {import('./config-loader.js').PrimitivesConfig} Primitives config
 */
function getConfig() {
  if (!cachedConfig) {
    const raw = readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
    cachedConfig = JSON.parse(raw);
  }
  return cachedConfig;
}

/**
 * Sets a custom primitives configuration (useful for testing or dynamic reload).
 * @param {import('./config-loader.js').PrimitivesConfig | null} config - Config to use, or null to reset
 */
export function setConfig(config) {
  cachedConfig = config;
}

/**
 * @typedef {Object} PrimitiveResult
 * @property {string} name - Primitive name
 * @property {string} category - Primitive category
 * @property {boolean} detected - Whether the primitive was found
 * @property {string[]} matchedFiles - List of matched file paths
 * @property {string} description - Primitive description
 * @property {string[]} docLinks - Documentation links
 * @property {string[]} assistants - Associated AI assistant IDs
 */

/**
 * Scans a file tree against configured primitive patterns.
 * Each primitive is checked against all file paths using glob matching.
 * @param {Array<{path: string, type: string}>} fileTree - Repository file tree entries
 * @param {import('./config-loader.js').PrimitivesConfig} [config] - Optional config override
 * @returns {PrimitiveResult[]} Detection results for each primitive
 */
export function scanRepository(fileTree, config) {
  const primitivesData = config || getConfig();
  const filePaths = fileTree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);

  return primitivesData.primitives.map((primitive) => {
    const assistantIds = Object.keys(primitive.assistants);
    const allPatterns = assistantIds.flatMap(
      (assistantId) => primitive.assistants[assistantId].patterns,
    );

    const matchedFiles = findMatchingFiles(filePaths, allPatterns);

    return {
      name: primitive.name,
      category: primitive.category,
      detected: matchedFiles.length > 0,
      matchedFiles,
      description: primitive.description,
      docLinks: primitive.docLinks,
      assistants: assistantIds,
    };
  });
}

/**
 * Finds files that match any of the given glob patterns.
 * @param {string[]} filePaths - Array of file paths to check
 * @param {string[]} patterns - Glob patterns to match against
 * @returns {string[]} Matched file paths (deduplicated)
 */
function findMatchingFiles(filePaths, patterns) {
  const matched = new Set();

  for (const filePath of filePaths) {
    for (const pattern of patterns) {
      if (minimatch(filePath, pattern, { dot: true })) {
        matched.add(filePath);
        break; // One match per file is sufficient
      }
    }
  }

  return [...matched];
}
