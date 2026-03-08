import { minimatch } from 'minimatch';

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
    const allMatchedFiles = [];

    for (const [assistantId, config] of Object.entries(primitive.assistants)) {
      const matchedFiles = [];

      for (const pattern of config.patterns) {
        for (const filePath of paths) {
          if (minimatch(filePath, pattern, { dot: true })) {
            if (!matchedFiles.includes(filePath)) {
              matchedFiles.push(filePath);
            }
          }
        }
      }

      assistantResults[assistantId] = {
        detected: matchedFiles.length > 0,
        matched_files: matchedFiles,
      };

      for (const f of matchedFiles) {
        if (!allMatchedFiles.includes(f)) {
          allMatchedFiles.push(f);
        }
      }
    }

    return {
      name: primitive.name,
      category: primitive.category,
      detected: allMatchedFiles.length > 0,
      matched_files: allMatchedFiles,
      description: primitive.description,
      doc_links: primitive.docLinks,
      assistant_results: assistantResults,
    };
  });
}
