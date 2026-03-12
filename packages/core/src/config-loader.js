import { BundledConfigSource, ComposedConfigSource, FileSystemConfigSource } from './config-source.js';

/**
 * Loads and validates the primitives configuration.
 * @param {string} [filePath] - Absolute or relative path to primitives.json
 * @returns {{ primitives: object[] }} Validated primitives config
 */
export function loadPrimitives(filePath) {
  const configSource = filePath
    ? new FileSystemConfigSource({ primitivesPath: filePath })
    : new BundledConfigSource();
  return configSource.loadPrimitives();
}

/**
 * Loads and validates the assistants configuration.
 * @param {string} [filePath] - Absolute or relative path to assistants.json
 * @returns {{ assistants: object[] }} Validated assistants config
 */
export function loadAssistants(filePath) {
  const configSource = filePath
    ? new FileSystemConfigSource({ assistantsPath: filePath })
    : new BundledConfigSource();
  return configSource.loadAssistants();
}

/**
 * Loads and validates both configuration files.
 * @param {{ primitivesPath?: string, assistantsPath?: string }} [paths]
 * @returns {{ primitives: object[], assistants: object[] }}
 */
export function loadConfig({ primitivesPath, assistantsPath } = {}) {
  const configSource = primitivesPath || assistantsPath
    ? new ComposedConfigSource([
        new FileSystemConfigSource({ primitivesPath, assistantsPath }),
        new BundledConfigSource(),
      ])
    : new BundledConfigSource();

  return configSource.loadConfig();
}