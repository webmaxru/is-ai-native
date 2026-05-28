import { Minimatch } from 'minimatch';

const MINIMATCH_OPTIONS = { dot: true };

// Pattern compilation is the hottest part of scanning: every call to
// `minimatch(file, pattern, opts)` reparses the glob into a regex. For a
// repo with N files and P patterns that's N*P recompilations per scan.
// We compile each unique pattern once and reuse the matcher across all
// paths and across repeated scans (config patterns are static strings).
const matcherCache = new Map();

function getMatcher(pattern) {
  let matcher = matcherCache.get(pattern);
  if (!matcher) {
    matcher = new Minimatch(pattern, MINIMATCH_OPTIONS);
    matcherCache.set(pattern, matcher);
  }
  return matcher;
}

/**
 * Scans a list of file paths against configured primitive definitions.
 * Uses minimatch for glob pattern matching with dot-file support.
 *
 * @param {string[]} paths - File paths from the repository tree
 * @param {object[]} primitiveDefs - Primitive definitions from primitives.json
 * @returns {object[]} Per-primitive scan results with per-assistant breakdown
 */
export function scanPrimitives(paths, primitiveDefs) {
  return primitiveDefs.map((primitive) => {
    const assistantResults = {};
    // Sets give O(1) dedup (was O(n) Array.includes) and preserve insertion
    // order, so downstream consumers still see files in first-match order.
    const allMatchedFiles = new Set();

    for (const [assistantId, config] of Object.entries(primitive.assistants)) {
      const matchedFiles = new Set();

      for (const pattern of config.patterns) {
        const matcher = getMatcher(pattern);
        for (const filePath of paths) {
          if (matchedFiles.has(filePath)) {
            continue;
          }
          if (matcher.match(filePath)) {
            matchedFiles.add(filePath);
          }
        }
      }

      const matchedFilesList = [...matchedFiles];
      assistantResults[assistantId] = {
        detected: matchedFilesList.length > 0,
        matched_files: matchedFilesList,
      };

      for (const filePath of matchedFiles) {
        allMatchedFiles.add(filePath);
      }
    }

    return {
      name: primitive.name,
      category: primitive.category,
      detected: allMatchedFiles.size > 0,
      matched_files: [...allMatchedFiles],
      description: primitive.description,
      doc_links: primitive.docLinks,
      assistant_results: assistantResults,
    };
  });
}