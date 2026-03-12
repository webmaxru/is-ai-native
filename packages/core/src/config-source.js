import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = join(__dirname, '../config');

/**
 * Validates a single primitive definition from primitives.json.
 * @param {object} primitive - Primitive definition
 * @param {number} index - Index in the array (for error messages)
 * @returns {string|null} Error message or null if valid
 */
export function validatePrimitive(primitive, index) {
  if (!primitive.name || typeof primitive.name !== 'string') {
    return `primitives[${index}].name must be a non-empty string`;
  }
  if (!primitive.category || typeof primitive.category !== 'string') {
    return `primitives[${index}].category must be a non-empty string`;
  }
  if (!primitive.description || typeof primitive.description !== 'string') {
    return `primitives[${index}].description must be a non-empty string`;
  }
  if (!Array.isArray(primitive.docLinks) || primitive.docLinks.length === 0) {
    return `primitives[${index}].docLinks must be a non-empty array`;
  }
  if (!primitive.assistants || typeof primitive.assistants !== 'object' || Object.keys(primitive.assistants).length === 0) {
    return `primitives[${index}].assistants must be a non-empty object`;
  }
  for (const [assistantId, def] of Object.entries(primitive.assistants)) {
    if (!Array.isArray(def.patterns) || def.patterns.length === 0) {
      return `primitives[${index}].assistants.${assistantId}.patterns must be a non-empty array`;
    }
  }
  return null;
}

/**
 * Validates a single assistant definition from assistants.json.
 * @param {object} assistant - Assistant definition
 * @param {number} index - Index in the array
 * @returns {string|null} Error message or null if valid
 */
export function validateAssistant(assistant, index) {
  if (!assistant.id || typeof assistant.id !== 'string') {
    return `assistants[${index}].id must be a non-empty string`;
  }
  if (!assistant.name || typeof assistant.name !== 'string') {
    return `assistants[${index}].name must be a non-empty string`;
  }
  return null;
}

function readJsonFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read ${label} config: ${path} — ${err.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${label} config: ${path}`);
  }
}

function validatePrimitivesConfig(data) {
  if (!Array.isArray(data.primitives) || data.primitives.length === 0) {
    throw new Error('primitives.json must contain a non-empty "primitives" array');
  }

  for (let index = 0; index < data.primitives.length; index += 1) {
    const errorMessage = validatePrimitive(data.primitives[index], index);
    if (errorMessage) {
      throw new Error(`Invalid primitives.json: ${errorMessage}`);
    }
  }

  return data;
}

function validateAssistantsConfig(data) {
  if (!Array.isArray(data.assistants) || data.assistants.length === 0) {
    throw new Error('assistants.json must contain a non-empty "assistants" array');
  }

  for (let index = 0; index < data.assistants.length; index += 1) {
    const errorMessage = validateAssistant(data.assistants[index], index);
    if (errorMessage) {
      throw new Error(`Invalid assistants.json: ${errorMessage}`);
    }
  }

  return data;
}

function isNoPathConfiguredError(error) {
  return error?.message === 'No primitives path configured' || error?.message === 'No assistants path configured';
}

/**
 * Base class for loading scanner configuration from different sources.
 */
export class ConfigSource {
  loadPrimitives() {
    throw new Error('ConfigSource.loadPrimitives() must be implemented by a subclass');
  }

  loadAssistants() {
    throw new Error('ConfigSource.loadAssistants() must be implemented by a subclass');
  }

  loadConfig() {
    const { primitives } = this.loadPrimitives();
    const { assistants } = this.loadAssistants();
    return { primitives, assistants };
  }
}

/**
 * Loads the built-in configuration bundled with @is-ai-native/core.
 */
export class BundledConfigSource extends ConfigSource {
  loadPrimitives() {
    return validatePrimitivesConfig(readJsonFile(join(CONFIG_DIR, 'primitives.json'), 'primitives'));
  }

  loadAssistants() {
    return validateAssistantsConfig(readJsonFile(join(CONFIG_DIR, 'assistants.json'), 'assistants'));
  }
}

/**
 * Loads configuration from explicit filesystem paths.
 */
export class FileSystemConfigSource extends ConfigSource {
  /**
   * @param {{ primitivesPath?: string, assistantsPath?: string }} [paths]
   */
  constructor({ primitivesPath, assistantsPath } = {}) {
    super();
    this.primitivesPath = primitivesPath;
    this.assistantsPath = assistantsPath;
  }

  loadPrimitives() {
    if (!this.primitivesPath) {
      throw new Error('No primitives path configured');
    }
    return validatePrimitivesConfig(readJsonFile(this.primitivesPath, 'primitives'));
  }

  loadAssistants() {
    if (!this.assistantsPath) {
      throw new Error('No assistants path configured');
    }
    return validateAssistantsConfig(readJsonFile(this.assistantsPath, 'assistants'));
  }
}

/**
 * Resolves configuration from multiple sources, allowing partial overrides.
 */
export class ComposedConfigSource extends ConfigSource {
  /**
   * @param {ConfigSource[]} sources
   */
  constructor(sources = []) {
    super();
    this.sources = sources.filter(Boolean);
  }

  loadPrimitives() {
    let lastError = null;
    for (const source of this.sources) {
      try {
        return source.loadPrimitives();
      } catch (error) {
        if (!isNoPathConfiguredError(error)) {
          lastError = error;
        }
      }
    }

    throw lastError || new Error('No primitives config source could be resolved');
  }

  loadAssistants() {
    let lastError = null;
    for (const source of this.sources) {
      try {
        return source.loadAssistants();
      } catch (error) {
        if (!isNoPathConfiguredError(error)) {
          lastError = error;
        }
      }
    }

    throw lastError || new Error('No assistants config source could be resolved');
  }
}
